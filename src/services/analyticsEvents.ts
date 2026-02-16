export type AnalyticsPrimitive = string | number | boolean | null | undefined;
export type AnalyticsParams = Record<string, AnalyticsPrimitive>;

export interface AnalyticsEventMap {
    route_change: { mode: string; has_params: boolean };
    ui_click: {
        tag: string;
        id: string;
        class_name: string;
        action: string;
        name: string;
        label: string;
        click_key: string;
        route_hash: string;
    };
    ui_change: {
        tag: string;
        id: string;
        class_name: string;
        action: string;
        name: string;
        label: string;
        click_key: string;
        route_hash: string;
        value: string;
    };
    ui_submit: {
        form_id: string;
        form_class: string;
    };
    generator_start_button_click: {
        tag: string;
        id: string;
        class_name: string;
        action: string;
        name: string;
        label: string;
        click_key: string;
        route_hash: string;
    };
    app_error: {
        kind: "window_error" | "unhandled_rejection";
        message: string;
        source: string;
        line: number;
        col: number;
        route_hash: string;
        app_version: string;
        mode: string;
    };
    js_error: {
        kind: string;
        message: string;
        source?: string;
        line?: number;
        col?: number;
    };
    admin_delete_uebung: Record<string, never>;
    admin_open_generator: Record<string, never>;
    admin_open_uebungsleitung: Record<string, never>;
    download_all_pdfs_zip: { teilnehmer_count: number };
    generator_add_teilnehmer: { count: number };
    generator_copy_json: Record<string, never>;
    generator_remove_teilnehmer: { count: number };
    generator_start_uebung: { teilnehmer_count: number; nachrichten_count: number };
    teilnehmer_change_doc_page: { mode: string; page: number };
    teilnehmer_download_zip: Record<string, never>;
    teilnehmer_set_doc_mode: { mode: string };
    teilnehmer_toggle_hide_transmitted: { checked: boolean };
    teilnehmer_toggle_uebertragen: { checked: boolean };
    uebungsleitung_download_debrief_pdf: Record<string, never>;
    uebungsleitung_export_pdf: Record<string, never>;
    uebungsleitung_mark_abgesetzt: { nr: number };
    uebungsleitung_mark_angemeldet: Record<string, never>;
    uebungsleitung_reset_nachricht: { nr: number };
    uebungsleitung_toggle_staerke_details: { enabled: boolean };
}

export type AnalyticsEventName = keyof AnalyticsEventMap;

