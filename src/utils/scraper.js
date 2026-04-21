const autoScroll = async (page) => {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 500;

      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;

        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 300);
    });
  });
};

const formatDate = (str) => {
  if (!str) return null;
  const clean = str.replace(/\s+/g, " ").trim(); // remove newlines
  const date = new Date(clean);
  return isNaN(date) ? null : date.toISOString().split("T")[0];
};

const limit = (val, len = 50) => {
  return val ? val.substring(0, len) : null;
};

module.exports = { autoScroll };