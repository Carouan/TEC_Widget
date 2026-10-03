export const DEV_CMD_ACTIONS = Object.freeze(["ISSUE","ANALYZE","FIX","CONTINUE","REVIEW"]);

function uuid(){
  return globalThis.crypto?.randomUUID?.() || `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createDevCmdBlock({action="ISSUE",description="",version="0.1.0",requestId=uuid()} = {}){
  const normalized=String(action||"ISSUE").toUpperCase();
  const safeAction=DEV_CMD_ACTIONS.includes(normalized)?normalized:"ISSUE";
  return [
    "[DEV-CMD]",
    "",
    "PROTOCOL: DEV-CMD/1",
    "PROJECT: tec-widget",
    `ACTION: ${safeAction}`,
    `REQUEST-ID: ${requestId}`,
    "REPOSITORY: Carouan/TEC_Widget",
    version ? `VERSION: ${version}` : null,
    "",
    "DESCRIPTION:",
    String(description||"").trim()
  ].filter((line)=>line!==null).join("\n");
}

export function buildGitHubIssueUrl(payload={}){
  const action=String(payload.action||"ISSUE").toUpperCase();
  const url=new URL("https://github.com/Carouan/TEC_Widget/issues/new");
  url.searchParams.set("labels","dev-cmd");
  url.searchParams.set("title",`[DEV-CMD] ${action} — tec-widget`);
  url.searchParams.set("body",createDevCmdBlock(payload));
  return url.toString();
}

export function buildMailUrl(payload={}){
  const action=String(payload.action||"ISSUE").toUpperCase();
  const url=new URL("mailto:");
  url.searchParams.set("subject",`[DEV-CMD] ${action} — TEC Widget`);
  url.searchParams.set("body",createDevCmdBlock(payload));
  return url.toString();
}
