import * as path from "path";
import * as fs from "fs";

const cacheDirPath = path.join(__dirname, "..", "..", "cache");

export function writeDataToFile(data: any, fileName: string) {
  if (!fs.existsSync(cacheDirPath)) {
    fs.mkdirSync(cacheDirPath);
  }
  fs.writeFileSync(
    path.join(cacheDirPath, fileName),
    JSON.stringify(data),
    "utf8"
  );
}

export function readDataFromFile(fileName: string) {
  const filePath = path.join(cacheDirPath, fileName);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function isCached(fileName: string) {
  return fs.existsSync(path.join(cacheDirPath, fileName));
}
