use base64::{engine::general_purpose, Engine as _};

const MAX_ARTWORK_BYTES: usize = 5 * 1024 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ArtworkMime {
    Jpeg,
    Png,
}

impl ArtworkMime {
    fn as_str(self) -> &'static str {
        match self {
            Self::Jpeg => "image/jpeg",
            Self::Png => "image/png",
        }
    }
}

pub(crate) fn detect_artwork_mime(bytes: &[u8]) -> Option<ArtworkMime> {
    if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        return Some(ArtworkMime::Jpeg);
    }
    if bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]) {
        return Some(ArtworkMime::Png);
    }

    None
}

pub(crate) fn bytes_to_data_url(bytes: &[u8]) -> Option<String> {
    if bytes.is_empty() || bytes.len() > MAX_ARTWORK_BYTES {
        return None;
    }

    let mime = detect_artwork_mime(bytes)?;
    Some(format!(
        "data:{};base64,{}",
        mime.as_str(),
        general_purpose::STANDARD.encode(bytes)
    ))
}

#[cfg(windows)]
#[allow(dead_code)]
pub(crate) async fn thumbnail_to_data_url(
    thumbnail: windows::Storage::Streams::IRandomAccessStreamReference,
) -> anyhow::Result<Option<String>> {
    use windows::Storage::Streams::DataReader;

    let stream = thumbnail.OpenReadAsync()?.await?;
    let size = stream.Size()? as usize;
    if size == 0 || size > MAX_ARTWORK_BYTES {
        return Ok(None);
    }

    let reader = DataReader::CreateDataReader(&stream)?;
    reader.LoadAsync(size as u32)?.await?;

    let mut bytes = vec![0_u8; size];
    reader.ReadBytes(&mut bytes)?;

    Ok(bytes_to_data_url(&bytes))
}

#[cfg(test)]
mod tests {
    use super::{bytes_to_data_url, detect_artwork_mime, ArtworkMime, MAX_ARTWORK_BYTES};

    #[test]
    fn detects_jpeg_and_png_magic_bytes() {
        assert_eq!(
            detect_artwork_mime(&[0xFF, 0xD8, 0xFF, 0xE0]),
            Some(ArtworkMime::Jpeg)
        );
        assert_eq!(
            detect_artwork_mime(&[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]),
            Some(ArtworkMime::Png)
        );
        assert_eq!(detect_artwork_mime(b"not image"), None);
    }

    #[test]
    fn converts_valid_image_bytes_to_data_url() {
        assert_eq!(
            bytes_to_data_url(&[0xFF, 0xD8, 0xFF]),
            Some("data:image/jpeg;base64,/9j/".to_string())
        );
    }

    #[test]
    fn rejects_empty_unknown_or_oversized_artwork() {
        assert_eq!(bytes_to_data_url(&[]), None);
        assert_eq!(bytes_to_data_url(b"not image"), None);

        let oversized = vec![0_u8; MAX_ARTWORK_BYTES + 1];
        assert_eq!(bytes_to_data_url(&oversized), None);
    }
}
