//! UI language for the native surfaces (the tray menu). The WebViews carry
//! their own string tables; both follow the persisted `language` setting,
//! where `"auto"` means the operating system's UI language.

pub const LANGUAGE_AUTO: &str = "auto";
pub const LANGUAGES: &[&str] = &[LANGUAGE_AUTO, "en", "ru"];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Language {
    En,
    Ru,
}

impl Language {
    /// Resolves a `language` setting value; unknown values behave like auto.
    pub fn resolve(setting: &str) -> Self {
        match setting {
            "en" => Self::En,
            "ru" => Self::Ru,
            _ => Self::from_locale(sys_locale::get_locale().as_deref()),
        }
    }

    fn from_locale(locale: Option<&str>) -> Self {
        match locale {
            Some(tag) if tag.to_ascii_lowercase().starts_with("ru") => Self::Ru,
            _ => Self::En,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::Language;

    #[test]
    fn explicit_choices_win_and_auto_reads_the_locale() {
        assert_eq!(Language::resolve("ru"), Language::Ru);
        assert_eq!(Language::resolve("en"), Language::En);
        assert_eq!(Language::from_locale(Some("ru-RU")), Language::Ru);
        assert_eq!(Language::from_locale(Some("ru_UA.UTF-8")), Language::Ru);
        assert_eq!(Language::from_locale(Some("en-US")), Language::En);
        assert_eq!(Language::from_locale(None), Language::En);
    }
}
