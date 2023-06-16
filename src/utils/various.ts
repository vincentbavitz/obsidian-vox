import manifest from "../../manifest.json";

export function timer(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export function log(message: string) {
  console.log(
    `%c${manifest.name}: %c${message}`,
    "color: blue;font-weight: bold;",
    "color: black"
  );
}
