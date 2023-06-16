// import { ExecSyncOptionsWithStringEncoding, execSync } from "child_process";
// import { DateTime } from "luxon";
// import config from "../../config.json";
// import { GIT_COMMMIT_DATE_FORMAT } from "../constants";
// import { log } from "./various";

/** Commit changes made to the output direcory */
export const commitChanges = async () => {
  // const execOptions: ExecSyncOptionsWithStringEncoding = {
  //   cwd: config.outputDirectory,
  //   encoding: "utf8",
  // };
  // try {
  //   const gitStatusResult = execSync("git status -s", execOptions);
  //   // Find out how many new markdown files we generated since the last commit.
  //   const newMarkdownFiles = gitStatusResult
  //     .split("\n")
  //     .filter((line) => Boolean(line.match(/[.]md"$/))).length;
  //   log(`Committing ${newMarkdownFiles} new transcription(s).`);
  //   const commitDateTime = DateTime.now().toFormat(GIT_COMMMIT_DATE_FORMAT);
  //   const commitMessage = config.commitMessageTemplate
  //     .replace("{datetime}", commitDateTime)
  //     .replace("{amount}", String(newMarkdownFiles));
  //   execSync("git add .", execOptions);
  //   execSync("git pull --no-rebase", execOptions);
  //   execSync(`git commit -m "${commitMessage}"`, execOptions);
  //   execSync("git push", execOptions);
  // } catch (error) {
  //   log(`Git Error: ${error}`);
  // }
};
