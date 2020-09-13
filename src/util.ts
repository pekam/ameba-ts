import * as fs from "fs";
import * as path from "path";

/**
 * Returns the average of the provided numbers.
 */

export const avg: (values: number[]) => number = (values) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

/**
 * Applies the function to the value if the condition is true, otherwise
 * returns the value.
 */
export const applyIf = <T>(condition: boolean, func: (T) => T, value: T): T => {
  if (condition) {
    return func(value);
  } else {
    return value;
  }
};

const dataDirPath = path.join(__dirname, "..", "data");
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
