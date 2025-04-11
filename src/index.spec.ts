import { it, expect } from "bun:test";
import { Superload } from "./index";

it("loads a single key", async () => {
  const loaderCalls: string[][] = [];
  const loader = new Superload<string, string>({
    id: key => key,
    loader: async keys => {
      loaderCalls.push(keys);
      return keys.map(key => `${key}-loaded`);
    }
  });

  const result = await loader.load("a");
  expect(result).toBe("a-loaded");
  expect(loaderCalls).toEqual([["a"]]);
});

it("deduplicates multiple calls for the same key", async () => {
  const loaderCalls: string[][] = [];
  const loader = new Superload<string, string>({
    id: key => key,
    loader: async keys => {
      loaderCalls.push(keys);
      return keys.map(key => `${key}-loaded`);
    }
  });

  const promise1 = loader.load("dup");
  const promise2 = loader.load("dup");

  expect(promise1).toBe(promise2);
  const result = await promise1;
  expect(result).toBe("dup-loaded");
  expect(loaderCalls).toEqual([["dup"]]);
});

it("loads multiple keys using loadMany", async () => {
  const loader = new Superload<string, string>({
    id: key => key,
    loader: async keys => keys.map(key => `${key}-loaded`)
  });

  const results = await loader.loadMany(["a", "b", "c"]);
  expect(results).toEqual(["a-loaded", "b-loaded", "c-loaded"]);
});

it("rejects when the loader fails", async () => {
  const loader = new Superload<string, string>({
    id: key => key,
    loader: async _keys => {
      throw new Error("Loader failed");
    }
  });

  await expect(loader.load("error")).rejects.toThrow("Loader failed");
  await expect(loader.loadMany(["error1", "error2"])).rejects.toThrow(
    "Loader failed"
  );
});

it("deduplicates keys across load and loadMany calls", async () => {
  let callCount = 0;
  const receivedKeys: string[][] = [];
  const loader = new Superload<string, string>({
    id: key => key,
    loader: async keys => {
      callCount++;
      receivedKeys.push(keys);
      return keys.map(key => `${key}-loaded`);
    }
  });

  const promise1 = loader.load("a");
  const promise2 = loader.loadMany(["a", "b"]);
  const resultA = await promise1;
  const results = await promise2;

  expect(callCount).toBe(1);
  expect(receivedKeys[0].sort()).toEqual(["a", "b"]);
  expect(resultA).toBe("a-loaded");
  expect(results).toEqual(["a-loaded", "b-loaded"]);
});

it("makes separate batch calls for loads in different batch cycles", async () => {
  const receivedBatches: string[][] = [];
  const loader = new Superload<string, string>({
    delay: 0,
    id: key => key,
    loader: async keys => {
      receivedBatches.push([...keys]);
      return keys.map(key => `${key}-loaded`);
    }
  });

  const promise1 = loader.load("a");
  const promise2 = loader.load("b");

  await Promise.all([promise1, promise2]);

  const promise3 = loader.load("b");
  const promise4 = loader.load("c");

  await Promise.all([promise3, promise4]);

  expect(receivedBatches).toHaveLength(2);
  expect(receivedBatches[0]).toEqual(["a", "b"]);
  expect(receivedBatches[1]).toEqual(["b", "c"]);
  expect(await Promise.all([promise1, promise2, promise3, promise4])).toEqual([
    "a-loaded",
    "b-loaded",
    "b-loaded",
    "c-loaded"
  ]);
});

it("loads keys in parallel", async () => {
  const receivedBatches: string[][] = [];
  const loader = new Superload<string, string>({
    id: key => key,
    loader: async keys => {
      receivedBatches.push([...keys]);
      return keys.map(key => `${key}-loaded`);
    }
  });

  async function load(keys: string[]) {
    await loader.loadMany(keys);
  }

  await Promise.all([load(["a", "b"]), load(["c", "d"])]);

  expect(receivedBatches).toEqual([["a", "b", "c", "d"]]);
});
