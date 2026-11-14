/**
 * Project links (from `git remote -v`: origin https://github.com/ner4m1x/nasa-felicette-2026.git).
 * The docs/ folder is not served by the app, so the Mission Report links to it on GitHub.
 */
export const REPO_URL = "https://github.com/ner4m1x/nasa-felicette-2026";

export const docUrl = (file: string) => `${REPO_URL}/blob/main/docs/${file}`;

export const METHOD_DOCS = [
  { file: "MISSION_FIT.md", key: "report.methods.docMissionFit" },
  { file: "METHOD_LOG.md", key: "report.methods.docMethodLog" },
  { file: "DATA_SOURCES.md", key: "report.methods.docDataSources" },
] as const;

/** Written by the pipeline's validate step; linked only once validation_report.json exists. */
export const VALIDATION_DOC = "VALIDATION_REPORT.md";
