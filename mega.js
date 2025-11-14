const mega = require("megajs");

const auth = {
  email: "nadeelaff@gmail.com",   // ⚠️ replace with your own MEGA account
  password: "+EWcEz*;+p5U3X",     // ⚠️ replace with your own MEGA password
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246",
};

/**
 * Upload a file/stream to MEGA
 * @param {ReadableStream|Buffer} data - file data or readable stream
 * @param {string} name - filename to store in MEGA
 * @returns {Promise<string>} - public link to uploaded file
 */
const upload = (data, name) => {
  return new Promise((resolve, reject) => {
    const storage = new mega.Storage(auth);

    storage.on("ready", () => {
      console.log("MEGA storage ready. Uploading:", name);

      const uploadStream = storage.upload({ name });

      // Pipe if it's a stream, else write buffer directly
      if (data && typeof data.pipe === "function") {
        data.pipe(uploadStream);
      } else {
        uploadStream.end(data);
      }

      uploadStream.on("complete", (file) => {
        file.link((err, url) => {
          storage.close(); // always close storage
          if (err) {
            reject(err);
          } else {
            resolve(url);
          }
        });
      });

      uploadStream.on("error", (err) => {
        storage.close();
        reject(err);
      });
    });

    storage.on("error", (err) => {
      reject(err);
    });
  });
};

module.exports = { upload };
