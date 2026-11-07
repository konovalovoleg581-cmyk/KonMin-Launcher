// KonMin Launcher — точка входа бэкенда (Tauri 2)
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod auth;
mod bedrock;
mod instances;
mod java;
mod launch;
mod loaders;
mod modrinth;
mod net;
mod paths;
mod settings;
mod skins;
mod versions;

/// Преобразование любой ошибки в строку для фронтенда (с цепочкой причин).
pub fn err<E: std::fmt::Display>(e: E) -> String {
    format!("{e:#}")
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(launch::GameState::default())
        .manage(modrinth::Cache::default())
        .invoke_handler(tauri::generate_handler![
            // настройки
            settings::get_settings,
            settings::save_settings,
            settings::system_info,
            settings::open_url,
            settings::open_data_folder,
            // аккаунты
            auth::list_accounts,
            auth::ely_login,
            auth::add_guest,
            auth::set_active_account,
            auth::logout,
            // версии и загрузчики
            versions::get_version_manifest,
            loaders::get_loader_versions,
            // сборки
            instances::list_instances,
            instances::create_instance,
            instances::update_instance,
            instances::delete_instance,
            instances::duplicate_instance,
            instances::open_instance_folder,
            instances::list_instance_content,
            instances::toggle_content,
            instances::delete_content,
            instances::export_mrpack,
            // запуск
            launch::launch_instance,
            launch::kill_game,
            launch::running_games,
            launch::open_crash_report,
            // modrinth
            modrinth::modrinth_get,
            modrinth::install_project,
            modrinth::install_modpack_version,
            modrinth::import_mrpack,
            modrinth::check_updates,
            modrinth::apply_update,
            // bedrock
            bedrock::bedrock_status,
            bedrock::launch_bedrock,
            bedrock::open_bedrock_store,
            // скины
            skins::get_ely_textures,
            skins::list_local_skins,
            skins::import_skin,
            skins::delete_local_skin,
            skins::prepare_ely_upload,
        ])
        .run(tauri::generate_context!())
        .expect("ошибка запуска KonMin Launcher");
}
