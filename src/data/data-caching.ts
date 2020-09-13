import * as path from "path";
import * as fs from "fs";

const dataDirPath = path.join(__dirname, "..", "..", "cache");

export function writeDataToFile(data: any, fileName: string) {
  if (!fs.existsSync(dataDirPath)) {
    fs.mkdirSync(dataDirPath);
  }
  fs.writeFileSync(
    path.join(dataDirPath, fileName),
    JSON.stringify(data),
    "utf8"
  );
}

export function readDataFromFile(fileName: string) {
  const filePath = path.join(dataDirPath, fileName);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
