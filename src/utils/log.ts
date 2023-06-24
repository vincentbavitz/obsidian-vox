import { PluginManifest } from "obsidian";


export class Logger {
  constructor(private readonly manifest: PluginManifest) {}

  public log(message: string) {
    console.log(
      `%c${this.manifest.name}: %c${message}`,
      "color: blue;font-weight: bold;",
      "color: black"
    );
  }
}
