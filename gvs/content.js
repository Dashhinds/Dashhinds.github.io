export const REFERENCES = Object.freeze([
  {
    title: "Melinda J. Menzer — The Great Vowel Shift",
    kind: "surviving original project",
    url: "https://facweb.furman.edu/~mmenzer/gvs/"
  },
  {
    title: "See and Hear the GVS",
    kind: "surviving original applet instructions",
    url: "https://facweb.furman.edu/~mmenzer/gvs/seehear.htm"
  },
  {
    title: "What is the Great Vowel Shift?",
    kind: "original eight-step framing and cautions",
    url: "https://facweb.furman.edu/~mmenzer/gvs/what.htm"
  },
  {
    title: "Words from the Dialogue",
    kind: "original example words and exceptions",
    url: "https://facweb.furman.edu/~mmenzer/gvs/words.htm"
  },
  {
    title: "Links, Sources, and Credits",
    kind: "original credits and bibliography",
    url: "https://facweb.furman.edu/~mmenzer/gvs/links.htm"
  },
  {
    title: "Java SE 26 — Removed APIs",
    kind: "official record of Applet API removal",
    url: "https://docs.oracle.com/en/java/javase/26/migrate/removed-apis.html"
  },
  {
    title: "CheerpJ — Run a Java Applet",
    kind: "conditional compatibility path if original bytes are recovered",
    url: "https://cheerpj.com/docs/getting-started/Java-applet"
  },
  {
    title: "Web Audio API",
    kind: "modern browser audio standard",
    url: "https://www.w3.org/TR/webaudio/"
  }
]);

export const ABOUT = Object.freeze({
  title: "A modern, preservation-minded Great Vowel Shift explorer",
  origin:
    "This clean-room browser implementation was inspired by Melinda J. Menzer's historical teaching website and its now-obsolete Java applet.",
  independence:
    "Its code is independently written and contains no recovered bytecode or transcription of the original implementation. Since 2026-09-08 it does carry the applet's own twelve vowel recordings (decoded losslessly, credited, under the original site's non-profit educational notice) and places vowels using the applet's recovered chart geometry.",
  purpose:
    "Its immediate purpose is to restore the documented learning operations—study by Middle English phoneme and by numbered step. A separate archival track recovered the applet's compiled classes, symbol images, and vowel recordings from the surviving Furman server in September 2026; those files stay unpublished pending rights review, and the original Java source has not been found."
});
