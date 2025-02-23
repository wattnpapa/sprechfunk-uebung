# Sprechfunk Übungsgenerator

Dies ist ein Werkzeug zur Erstellung von Übungsszenarien für den Sprechfunk im BOS (Behörden und Organisationen mit Sicherheitsaufgaben). Die Anwendung ermöglicht es, Funksprüche für Übungsteilnehmer zu generieren und diese in verschiedenen Formaten zu exportieren.

## Funktionen

1. **Vorlagen-Auswahl**  
   Der Nutzer kann entweder eine vorgefertigte Funkspruchvorlage auswählen oder eine eigene Funkspruchliste hochladen. Es gibt zwei Hauptoptionen:
   - **Vorlage auswählen**: Wählen Sie aus einer Liste vordefinierter Funkspruchvorlagen aus.
   - **Manuelle Datei hochladen**: Ermöglicht das Hochladen einer benutzerdefinierten Funkspruchliste im Textformat.

2. **Erstellung der Übung**  
   Nachdem eine Vorlage oder eine benutzerdefinierte Datei ausgewählt wurde, können Sie die Übung mit den entsprechenden Teilnehmern generieren. Die Übung umfasst die folgenden Parameter:
   - **Datum der Übung**
   - **Name der Übung**
   - **Rufgruppe der Übung**
   - **Funkrufname der Übungsleitung**
   - **Anzahl der Funksprüche pro Teilnehmer**
   - **Prozentanteil an Nachrichten, die an alle oder mehrere Teilnehmer gesendet werden**

3. **Generierung der PDF-Dokumente**  
   Die Anwendung ermöglicht das Erstellen von PDF-Dokumenten:
   - **Teilnehmer-PDFs**: Eine PDF für jeden Teilnehmer, die ihre Funksprüche enthält.
   - **Nachrichtenvordruck PDFs**: Eine Vorlage für jeden Teilnehmer, auf der die Funksprüche entsprechend den Vorlage-Maßstäben angezeigt werden.
   - **Übungsleitung-PDF**: Eine PDF, die alle Details der Übung und Teilnehmer für die Übungsleitung enthält.

4. **Schätzzeit der Übung**  
   Auf Grundlage der Anzahl der Funksprüche und der Teilnehmer wird eine Schätzzeit für die Dauer der Übung in Minuten und Stunden angezeigt. Diese Schätzung berücksichtigt die Dauer des Sprechfunkverkehrs sowie mögliche Pausen und Verzögerungen.

5. **Seitenvorschau**  
   Nach der Generierung der Übung können Sie eine Vorschau der generierten Seiten einsehen. Diese Vorschau zeigt die Seiten des generierten PDFs, sodass Sie die Inhalte überprüfen können.

6. **Dynamische Vorlagen**  
   Sie können aus vordefinierten Funkspruchvorlagen wählen, die beim Starten der Übung geladen werden. Die Auswahl wird dynamisch gefüllt und die Funksprüche werden entsprechend der Vorlage generiert.

## Bedienung

1. **Kopfdaten Eingabe**  
   Geben Sie alle relevanten Informationen zu der Übung ein:
   - Datum der Übung
   - Name der Übung
   - Rufgruppe
   - Funkrufname der Übungsleitung

2. **Einstellungen für die Funksprüche**  
   Legen Sie die Anzahl der Funksprüche pro Teilnehmer sowie den Prozentsatz der Nachrichten fest, die an alle Teilnehmer oder mehrere Teilnehmer gesendet werden sollen.

3. **Vorlage oder Datei wählen**  
   - Wählen Sie eine Funkspruchvorlage aus dem Dropdown-Menü aus.
   - Oder laden Sie eine benutzerdefinierte Funkspruchliste hoch.

4. **Übung generieren**  
   Klicken Sie auf den Button "Übung generieren", um die Übung zu starten und die Funksprüche zu erstellen.

5. **Erstellung der PDFs**  
   Klicken Sie auf die entsprechenden Buttons, um:
   - Teilnehmer PDFs zu generieren.
   - Nachrichtenvordruck PDFs zu erstellen.
   - Die Übungsleitung PDF zu erzeugen.

6. **Seitenvorschau anzeigen**  
   Überprüfen Sie die Seiten der generierten PDFs im Vorschaufenster. Nutzen Sie die Navigation, um durch die Seiten zu blättern.

## Beispiel: Funkspruchgenerierung

1. **Vorlage auswählen**: Sie wählen eine Vorlage für „Sprechfunk Übung 2025“.
2. **Teilnehmer hinzufügen**: Sie fügen Teilnehmer wie „Heros Oldenburg 16/11“ hinzu.
3. **Funksprüche erstellen**: Nachdem Sie die Anzahl der Funksprüche und deren Verteilung konfiguriert haben, werden Funksprüche an alle Teilnehmer oder mehrere Teilnehmer verteilt.
4. **PDFs generieren**: Sie generieren PDFs für die Teilnehmer und die Übungsleitung, um sie auszudrucken oder zu teilen.

## Hinweise

- Alle Funksprüche und Daten werden in den generierten PDF-Dateien berücksichtigt und sind sowohl für die Teilnehmer als auch für die Übungsleitung sichtbar.
- Bei der Erstellung von PDFs mit Funksprüchen wird eine vordefinierte Vorlage verwendet, um die Nachricht korrekt darzustellen.
- Achten Sie darauf, die richtigen Dateiformate für die benutzerdefinierte Funkspruchliste zu verwenden (z. B. `.txt`).

## FAQ

### Wie kann ich eine benutzerdefinierte Funkspruchliste hochladen?
- Klicken Sie auf das Auswahlfeld für die Funkspruchvorlage und wählen Sie „Manuelle Datei hochladen“. Anschließend können Sie die Datei auswählen, die die Funksprüche enthält.

### Was passiert, wenn ich „Keine Lösungswörter“ auswähle?
- In diesem Fall werden keine Lösungswörter generiert oder angezeigt, und die Funksprüche werden ohne zusätzliche Daten erstellt.

### Wie funktioniert die Schätzzeit der Übung?
- Die Schätzzeit basiert auf der Anzahl der Funksprüche, der Anzahl der Empfänger und einer angenommenen Zeit pro Funkspruch. Diese Schätzung berücksichtigt auch mögliche Verzögerungen aufgrund von Wiederholungen.

---

**Viel Erfolg bei Ihrer Übung!**