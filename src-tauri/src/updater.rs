use crate::mpv::{self, MpvState};
use serde::Serialize;
use tauri::{Manager, ResourceId, Runtime, Webview};
use tauri_plugin_updater::UpdaterExt;
use url::Url;

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Metadata {
  rid: ResourceId,
  current_version: String,
  version: String,
  date: Option<String>,
  body: Option<String>,
  raw_json: serde_json::Value,
}

/// Checks a single, explicitly-provided `latest.json` URL rather than the
/// static endpoint(s) configured in `tauri.conf.json`, so the frontend can
/// resolve which GitHub release to check against per update channel
/// (stable vs. beta) and still reuse the plugin's own signature
/// verification / download / install machinery via the returned resource id.
#[tauri::command]
pub async fn check_update_at_endpoint<R: Runtime>(
  webview: Webview<R>,
  url: String,
) -> Result<Option<Metadata>, String> {
  let endpoint = Url::parse(&url).map_err(|e| e.to_string())?;
  let app_handle = webview.app_handle().clone();

  let updater = webview
    .updater_builder()
    .endpoints(vec![endpoint])
    .map_err(|e| e.to_string())?
    // `webview.updater_builder()` already wires this hook to
    // `app_handle.cleanup_before_exit()` (tray icons/resource cleanup), but
    // that alone leaves mpv running - and on Windows, `install()` launches
    // the NSIS/MSI installer and calls `std::process::exit(0)` right after
    // this hook runs, without ever reaching `RunEvent::Exit`, so this is the
    // only reliable point to guarantee mpv.exe is dead (and its file handle
    // released) before the installer tries to overwrite it. Override rather
    // than chain: replicate the default `cleanup_before_exit()` call
    // ourselves alongside the mpv kill.
    .on_before_exit(move || {
      mpv::kill_blocking(&app_handle.state::<MpvState>());
      app_handle.cleanup_before_exit();
    })
    .build()
    .map_err(|e| e.to_string())?;

  let update = updater.check().await.map_err(|e| e.to_string())?;

  let Some(update) = update else {
    return Ok(None);
  };

  let formatted_date = if let Some(date) = update.date {
    Some(
      date
        .format(&time::format_description::well_known::Rfc3339)
        .map_err(|e| e.to_string())?,
    )
  } else {
    None
  };

  let metadata = Metadata {
    current_version: update.current_version.clone(),
    version: update.version.clone(),
    date: formatted_date,
    body: update.body.clone(),
    raw_json: update.raw_json.clone(),
    rid: webview.resources_table().add(update),
  };

  Ok(Some(metadata))
}
