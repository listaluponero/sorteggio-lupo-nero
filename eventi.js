const XCEED_API = "https://script.google.com/macros/s/AKfycbwTxh_dWwG0I2SkM6Ax8C3uTfIjoBda5LuOQx_6JVqhQuz5WWuYYrChdy2Sj220UxscrA/exec";

window.eventi = [
  {
    linkBiglietti: "https://xceed.me/it/catania/event/purgatory-demonium-halloween-special-date/245837/channel/lista-lupo-nero"
  }
];

async function caricaEventiXceed() {
  for (const evento of window.eventi) {
    try {
      const url = XCEED_API + "?url=" +
        encodeURIComponent(evento.linkBiglietti);

      const risposta = await fetch(url);
      const risultato = await risposta.json();
      const dati = risultato.data;

      if (risultato.success && dati) {
        evento.nome = dati.name;
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
          : "Catania";
        evento.locandina = dati.coverUrl;
      }
    } catch (errore) {
      console.error("Errore nel caricamento Xceed:", errore);
    }
  }

  if (typeof window.renderEventi === "function") {
    window.renderEventi();
  }
}

caricaEventiXceed();
