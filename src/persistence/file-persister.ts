import * as fs from "fs";
import * as path from "path";
import { Persister, PersisterKey } from "./types";

/**
 * Returns a Persister that stores values in the file system. Each value has a
 * dedicated file, with path equal to '[baseDir]/[category]/[key].json'.
 *
 * The directories, including baseDir, are created on demand.
 */
export const filePersister = (baseDir: string): Persister => {
  const toFilePath = ({ category, key }: PersisterKey) => ({
    dir: path.join(baseDir, category),
    fileName: key + ".json",
  });

  return {
    async get(persisterKey: PersisterKey) {
      return readDataFromFile(toFilePath(persisterKey));
    },
    async set(key, value) {
      writeDataToFile({ ...toFilePath(key), data: value });
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
