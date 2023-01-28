import * as fs from "fs";
import * as path from "path";
import { Persister, PersisterKey } from "./types";

/**
 * Returns a Persister that stores values in the file system. Each value has a
 * dedicated file, with path equal to '[baseDir]/[category]/[key].json'.
 *
 * The provided baseDir must already exist. It's not created automatically to
 * avoid recursively creating directory structures in weird places if there's a
 * typo in the dir path.
 */
export const filePersister = (baseDir: string): Persister => {
  if (!fs.existsSync(baseDir)) {
    throw Error(
      `File persister needs an existing directory to store data, and ${baseDir} does not exist.`
    );
  }

  const toCategoryDirPath = (category: string) => path.join(baseDir, category);

  const toFilePath = ({ category, key }: PersisterKey) => ({
    dir: toCategoryDirPath(category),
    fileName: key + ".json",
  });

  return {
    async get(persisterKey: PersisterKey) {
      return readDataFromFile(toFilePath(persisterKey));
    },
    async set(key, value) {
      writeDataToFile({ ...toFilePath(key), data: value });
    },
    async getKeys(category) {
      return getJsonFileNamesInDir(toCategoryDirPath(category));
    },
  };
};

function writeDataToFile({
  dir,
  fileName,
  data,
}: {
  dir: string;
  fileName: string;
  data: any;
}) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(path.join(dir, fileName), JSON.stringify(data), "utf8");
}

function readDataFromFile({
  dir,
  fileName,
}: {
  dir: string;
  fileName: string;
}) {
  const filePath = path.join(dir, fileName);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getJsonFileNamesInDir(dir: string) {
  return fs
    .readdirSync(dir)
    .map(path.parse)
    .filter((path) => path.ext === ".json")
    .map((path) => path.name);
}
