// Platform media bridge.
//
// Windows talks to SMTC (WinRT), Linux talks to MPRIS over D-Bus, and every
// other target keeps the neutral "nothing playing" stubs.
#[cfg(any(windows, not(any(windows, target_os = "linux"))))]
pub(crate) use super::smtc::*;

#[cfg(target_os = "linux")]
pub(crate) use super::linux::*;
