export interface Nachricht {
    id: number;
    empfaenger: string[];
    nachricht: string;
    loesungsbuchstaben?: string[];
    staerken?: { fuehrer: number; unterfuehrer: number; helfer: number }[];
}