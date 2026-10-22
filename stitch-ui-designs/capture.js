const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

function findHtmlFiles(dir) {
  let files = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...findHtmlFiles(fullPath));
    }

    if (entry.isFile() && entry.name.toLowerCase() === "code.html") {
      files.push(fullPath);
    }
  }

  return files;
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-web-security", "--allow-file-access-from-files"],
  });

  const htmlFiles = findHtmlFiles(ROOT);

  console.log(`Found ${htmlFiles.length} HTML files`);

  for (const htmlPath of htmlFiles) {
    const page = await browser.newPage({
      viewport: {
        width: 1920,
        height: 1080,
      },
    });

    const fileUrl = "file:///" + htmlPath.replace(/\\/g, "/");

    console.log(`Capturing: ${htmlPath}`);

    try {
      await page.goto(fileUrl, {
        waitUntil: "load",
        timeout: 30000,
      });

      await page.waitForTimeout(5000);

      const outputPath = path.join(path.dirname(htmlPath), "screen.png");

      await page.screenshot({
        path: outputPath,
        fullPage: false,
      });

      console.log(`Saved: ${outputPath}`);
    } catch (err) {
      console.log(`Failed: ${htmlPath}`);
      console.log(err.message);
    }

    await page.close();
  }

  await browser.close();

  console.log("DONE");
})();
