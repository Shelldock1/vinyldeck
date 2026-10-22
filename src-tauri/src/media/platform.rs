// Platform media bridge.
//
// Windows talks to SMTC (WinRT), Linux talks to MPRIS over D-Bus, and every
// other target uses the neutral "nothing playing" stubs.
#[cfg(windows)]
pub(crate) use super::smtc::*;

#[cfg(target_os = "linux")]
pub(crate) use super::linux::*;

#[cfg(not(any(windows, target_os = "linux")))]
pub(crate) use super::unsupported::*;
