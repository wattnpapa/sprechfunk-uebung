document.addEventListener("DOMContentLoaded", function () {
    const modalContent = document.getElementById("howtoContent");

    // Funktion zum Laden der Markdown-Datei
    function loadHowTo() {
        fetch('howto.md')
            .then(response => response.text())
            .then(data => {
                const converter = new showdown.Converter();
                modalContent.innerHTML = converter.makeHtml(data);
            })
            .catch(error => {
                console.error('Fehler beim Laden der Anleitung:', error);
                modalContent.innerHTML = 'Es gab einen Fehler beim Laden der Anleitung.';
            });
    }

    // Laden der Anleitung, wenn das Modal geöffnet wird
    const howtoModal = document.getElementById('howtoModal');
    howtoModal.addEventListener('show.bs.modal', loadHowTo);
});