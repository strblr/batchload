# superload

Simplest possible batch loader.

- Batches resource requests into a single call
- No cache

## Superload - A Simple Batched Resource Loader

The module exports the Superload class, which provides a simple way to batch asynchronous resource requests. It collects individual resource requests made within a short time frame (configurable) and consolidates them into a single batched call.

### API Reference

**Config<K, T>**

This interface defines the configuration for a Superload instance (passed to the constructor):

- **delay?** _(number)_: An optional delay in milliseconds before processing queued requests. Defaults to 0.
- **id** _(key: K) => string_: A function that returns a unique identifier for a given key. Used to deduplicate requests.
- **loader** _(keys: K[]) => Promise<(T | Error)[]>_: A function that accepts an array of keys and returns a promise which resolves to an array of corresponding resources. This function is invoked when the batch is processed. The order of returned values must match the order of keys. Errors can be returned individually to signal issues on specific resources.

**Superload<K, T>**

The main class responsible for the batching logic:

- **constructor(config: Config<K, T>)**
- **load(key: K): Promise\<T>**

  - Queues a single key for loading. If the same key is requested multiple times during a batching cycle, the returned promise is deduplicated and the key is only passed once to the loader.

- **loadMany(keys: K[]): Promise<T[]>**
  - Accepts an array of keys, queues them for loading, and returns a promise that resolves when all keys have been processed. The order of returned values matches the order of keys.

### Example Usage

```js
import { Superload } from "superload";

async function fetchUsers(ids: string[]) {
  console.log("Fetching users for:", ids);
  // Replace the following with your actual data retrieval logic, e.g., database or API call
  return ids.map(id => ({ id, name: `User ${id}` }));
}

// Instantiate the Superload for user data
const userLoader = new Superload({
  delay: 0, // Optional batching delay in ms (default: 0)
  id: key => key, // Here, we use the key itself as the unique identifier
  loader: fetchUsers // Function to fetch users in batch
});

// Loading a single user
const user = await userLoader.load("user-1");
console.log("Loaded user:", user);

// Loading multiple users
const [user1, user2, user3] = await userLoader.loadMany([
  "user-1",
  "user-2",
  "user-3"
]);
console.log("Loaded users:", [user1, user2, user3]);
```

### Error handling

- If the batched call promise is rejected as a whole, every **load** and **loadMany** promise that depends on it is rejected with the same reason.
- If the batched call resolves to an array containing some **Error** instances, the **load** and **loadMany** promises associated with these errors are rejected with the provided error.
