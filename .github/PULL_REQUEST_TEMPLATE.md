## Summary

Describe the user-visible change and the reason for it.

## Platforms tested

- [ ] Windows 10/11
- [ ] Linux (X11)
- [ ] Linux (Wayland)
- [ ] Not applicable (docs/CI only)

## Verification

- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm run test:frontend`
- [ ] `npm run fmt:rust`
- [ ] `npm run clippy:rust`
- [ ] `npm run test:rust`
- [ ] Bundle smoke check (if packaging changed)

## Checklist

- [ ] I updated `CHANGELOG.md` under `[Unreleased]` for user-visible changes.
- [ ] I updated the relevant docs.
- [ ] I added or updated tests where behavior changed.
- [ ] I did not commit secrets, signing keys, personal absolute paths or build output.
- [ ] Visual changes include a screenshot or recording.

## Notes for reviewers

Anything that could not be verified automatically, especially Windows-only behavior.
