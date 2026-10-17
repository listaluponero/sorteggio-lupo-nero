const XCEED_API = "https://script.google.com/macros/s/AKfycbwTxh_dWwG0I2SkM6Ax8C3uTfIjoBda5LuOQx_6JVqhQuz5WWuYYrChdy2Sj220UxscrA/exec";

window.eventi = [
  {
    nome: "PURGATORY // DEMONIUM // HALLOWEEN SPECIAL DATE",
    data: "31/10/2026 - Ore 22:00",
    locale: "Skyroom, Catania",
    locandina: "https://images.xceed.me/events/banners/purgatory-demonium-halloween-special-date-catania-xceed-square-845d.jpg",
    linkBiglietti: "https://xceed.me/it/catania/event/purgatory-demonium-halloween-special-date/245837/channel/lista-lupo-nero"
  }
];

async function caricaEventiXceed() {
  for (const evento of window.eventi) {
    try {
      const risposta = await fetch(
        XCEED_API + "?url=" +
        encodeURIComponent(evento.linkBiglietti)
      );

      const risultato = await risposta.json();

      if (!risultato.success || !risultato.data) continue;

      const dati = risultato.data;

      evento.nome = dati.name || evento.nome;
      evento.data = new Date(dati.startingTime * 1000)
        .toLocaleString("it-IT", {
          timeZone: "Europe/Rome",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        });

      evento.locale = dati.venue
        ? dati.venue.name + ", " +
          (dati.venue.address || "Catania")
        : evento.locale;

      evento.locandina = dati.coverUrl || evento.locandina;

    } catch (errore) {
      console.error("Errore nel recupero dati Xceed:", errore);
    }
  }

  if (typeof window.renderEvents === "function") {
    window.renderEvents();
  }
}

caricaEventiXceed();
