# How Larkin works animation assets

Larkin supplied these exports from the native app onboarding on 4 October 2026.
Each film is a muted 1260 × 1260 H.264 loop, with its matching PNG end frame.

- `day`: onboarding 1, unplanned conversations (11 seconds).
- `audio`: onboarding 3, words stay / audio does not (10 seconds).
- `account`: onboarding 4, private account space (9 seconds).

The page loads films as their sections become visible, pauses them out of view,
and uses the posters for reduced motion unless the reader explicitly presses Play.
The source exports are unchanged. CSS covers the account film’s “Only you” label
with “Private to your account”, alongside the page’s cloud-processing explanation.
