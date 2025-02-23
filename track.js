document.querySelector('button[onclick="startUebung()"]').addEventListener('click', function() {
    gtag('event', 'Übung_generieren', {
        'event_category': 'Button Click',
        'event_label': 'Übung generieren Button geklickt'
    });
});

document.querySelector('button[onclick="generatePDFs()"]').addEventListener('click', function() {
    gtag('event', 'Teilnehmer_PDF_generieren', {
        'event_category': 'Button Click',
        'event_label': 'Teilnehmer PDFs generieren Button geklickt'
    });
});

document.querySelector('button[onclick="generateNachrichtenvordruckPDFs()"]').addEventListener('click', function() {
    gtag('event', 'Nachrichtenvordruck_PDF_generieren', {
        'event_category': 'Button Click',
        'event_label': 'Nachrichtenvordruck PDFs generieren Button geklickt'
    });
});

document.querySelector('button[onclick="generateInstructorPDF()"]').addEventListener('click', function() {
    gtag('event', 'Übungsleitung_PDF_generieren', {
        'event_category': 'Button Click',
        'event_label': 'Übungsleitung PDF erzeugen Button geklickt'
    });
});