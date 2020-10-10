import { Db, MongoClient } from "mongodb";

/*
Functions for saving and loading data in MongoDB.
 */

// Expecting mongodb to run locally in the default port
const uri = "mongodb://localhost:27017/";

async function access(func: (db: Db) => any) {
  const client = new MongoClient(uri, { useUnifiedTopology: true });
  try {
    await client.connect();
    const db: Db = await client.db("trade");
    const result = await func(db);
    return result;
  } finally {
    await client.close();
  }
}

async function set(collection: string, id: any, value: any) {
  await access((db) =>
    db
      .collection(collection)
      .replaceOne({ _id: id }, { ...value, _id: id }, { upsert: true })
  );
}

async function get(collection: string, id: any) {
  return await access((db) => db.collection(collection).findOne({ _id: id }));
}

async function removeAll(collection: string) {
  return await access((db) => db.collection(collection).deleteMany({}));
}

export const db = {
  access,
  set,
  get,
  removeAll,
};
