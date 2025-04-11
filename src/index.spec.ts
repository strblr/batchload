import { it, expect } from "bun:test";
import { Batchloader } from "./index";

it("loads a single key", async () => {
  const loaderCalls: string[][] = [];
  const batchloader = new Batchloader<string, string>({
    id: key => key,
    loader: async keys => {
      loaderCalls.push(keys);
      return keys.map(key => `${key}-loaded`);
    }
  });

  const result = await batchloader.load("a");
  expect(result).toBe("a-loaded");
  expect(loaderCalls).toEqual([["a"]]);
});

it("deduplicates multiple calls for the same key", async () => {
  const loaderCalls: string[][] = [];
  const batchloader = new Batchloader<string, string>({
    id: key => key,
    loader: async keys => {
      loaderCalls.push(keys);
      return keys.map(key => `${key}-loaded`);
    }
  });

  const promise1 = batchloader.load("dup");
  const promise2 = batchloader.load("dup");

  expect(promise1).toBe(promise2);
  const result = await promise1;
  expect(result).toBe("dup-loaded");
  expect(loaderCalls).toEqual([["dup"]]);
});

it("loads multiple keys using loadMany", async () => {
  const batchloader = new Batchloader<string, string>({
    id: key => key,
    loader: async keys => keys.map(key => `${key}-loaded`)
  });

  const results = await batchloader.loadMany(["a", "b", "c"]);
  expect(results).toEqual(["a-loaded", "b-loaded", "c-loaded"]);
});

it("rejects when the loader fails", async () => {
  const batchloader = new Batchloader<string, string>({
    id: key => key,
    loader: async _keys => {
      throw new Error("Loader failed");
    }
  });

  await expect(batchloader.load("error")).rejects.toThrow("Loader failed");
  await expect(batchloader.loadMany(["error1", "error2"])).rejects.toThrow(
    "Loader failed"
  );
});

it("deduplicates keys across load and loadMany calls", async () => {
  let callCount = 0;
  const receivedKeys: string[][] = [];
  const batchloader = new Batchloader<string, string>({
    id: key => key,
    loader: async keys => {
      callCount++;
      receivedKeys.push(keys);
      return keys.map(key => `${key}-loaded`);
    }
  });

  const promise1 = batchloader.load("a");
  const promise2 = batchloader.loadMany(["a", "b"]);
  const resultA = await promise1;
  const results = await promise2;

  expect(callCount).toBe(1);
  expect(receivedKeys[0].sort()).toEqual(["a", "b"]);
  expect(resultA).toBe("a-loaded");
  expect(results).toEqual(["a-loaded", "b-loaded"]);
});

it("makes separate batch calls for loads in different batch cycles", async () => {
  const receivedBatches: string[][] = [];
  const batchloader = new Batchloader<string, string>({
    delay: 0,
    id: key => key,
    loader: async keys => {
      receivedBatches.push([...keys]);
      return keys.map(key => `${key}-loaded`);
    }
  });

  const promise1 = batchloader.load("a");
  const promise2 = batchloader.load("b");

  await Promise.all([promise1, promise2]);

  const promise3 = batchloader.load("b");
  const promise4 = batchloader.load("c");

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
