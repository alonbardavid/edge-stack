// Minimal on purpose and not legal advice: it covers only what the stack does.
// Replace it with the project's own policy, ideally from a lawyer, before
// launch, and keep it true to what the app collects, stores and shares.

/** The date this policy last changed in a way visitors should hear about. */
export const PRIVACY_POLICY_VERSION = "REPLACE_WITH_TODAY";

export const PRIVACY_CONTACT_EMAIL = "REPLACE_WITH_PRIVACY_EMAIL";

export const PRIVACY_SECTIONS = [
  {
    title: "What we collect",
    body: "We collect the name and email address on your account and what you keep in it, what every request carries — your IP address and browser — which our hosting provider logs, and analytics about how the site is used.",
  },
  {
    title: "Why we collect it, and who else sees it",
    body: "We use it to run the service for you, which is the contract between us, and to keep it secure and understand how it is used so we can improve it, which is our legitimate interest; where we ask before storing anything on your device, that storage rests on your consent. It reaches our analytics provider, PostHog Inc., and our hosting provider, Cloudflare, both in the United States, and anyone the law compels us to tell. We do not sell it.",
  },
  {
    title: "What we store on your device",
    body: "One cookie keeps you signed in, and your browser remembers your answer to our tracking banner. If you allow tracking we also keep a random identifier in your browser; if you decline, or your browser sends a Global Privacy Control signal, we do not, and your browser sends us nothing.",
  },
  {
    title: "Your rights",
    body: `You can ask us for a copy of your data, to correct or delete it, or to object to how we use it, and you can complain to your data protection authority. We keep account data for as long as your account exists, and analytics for no more than 12 months. Email ${PRIVACY_CONTACT_EMAIL} with any request or question; any change to this policy appears here.`,
  },
];

export const DO_NOT_SELL_LABEL = "Do Not Sell or Share My Personal Information";
