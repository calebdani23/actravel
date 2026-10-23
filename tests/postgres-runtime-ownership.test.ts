import assert from "node:assert/strict";
import test from "node:test";
import { withPostgresContainer } from "./helpers/postgres-runtime";

test("startup name collision never removes an existing foreign container", async () => {
  const calls: string[][] = [];
  const conflict = new Error("container name is already in use");
  await assert.rejects(withPostgresContainer(async () => assert.fail("must not run"), {
    containerName: "foreign-container",
    invoke: async (args) => {
      calls.push(args);
      if (args[0] === "run") throw conflict;
      return "";
    },
  }), (error) => error === conflict);
  assert.equal(calls.some((args) => args[0] === "rm"), false);
});

test("ambiguous startup failure removes only its uniquely labelled container ID", async () => {
  const calls: string[][] = [];
  let label = "", alive = false;
  await assert.rejects(withPostgresContainer(async () => assert.fail("must not run"), {
    containerName: "test-owned",
    invoke: async (args) => {
      calls.push(args);
      if (args[0] === "run") {
        label = args[args.indexOf("--label") + 1];
        alive = true;
        throw new Error("startup timed out after creation");
      }
      if (args[0] === "ps") {
        assert.equal(args.at(-1), `label=${label}`);
        return alive ? "a".repeat(64) : "";
      }
      if (args[0] === "rm") {
        assert.deepEqual(args, ["rm", "-f", "a".repeat(64)]);
        alive = false;
      }
      return "";
    },
  }), /startup timed out/);
  assert.match(label, /^actravel.test.owner=[0-9a-f-]{36}$/);
  assert.equal(alive, false);
  assert.equal(calls.filter((args) => args[0] === "rm").length, 1);
});

test("overlapping same-name attempts preserve the active sibling and its SQL result", async () => {
  const id = "b".repeat(64);
  let owner: string | null = null;
  const labels: string[] = [];
  const removed: string[] = [];
  const invoke = async (args: string[]) => {
    if (args[0] === "run") {
      const label = args[args.indexOf("--label") + 1];
      labels.push(label);
      if (owner) throw new Error("name conflict");
      owner = label;
      return id;
    }
    if (args[0] === "ps") return owner && args.at(-1) === `label=${owner}` ? id : "";
    if (args[0] === "rm") {
      assert.equal(args.at(-1), id);
      removed.push(id);
      owner = null;
    }
    return " 42\n";
  };
  const options = { containerName: "shared", invoke, readinessAttempts: 3, readinessDelayMs: 0 };
  const result = await withPostgresContainer(async (database) => {
    const originalOwner = owner;
    await assert.rejects(withPostgresContainer(async () => assert.fail("collision ran"), options), /name conflict/);
    assert.equal(owner, originalOwner);
    return database.psql("postgres", "select 42");
  }, options);
  assert.equal(result, "42");
  assert.equal(new Set(labels).size, 2);
  assert.deepEqual(removed, [id]);
  assert.equal(owner, null);
});
