# The render machine.
#
# Headless Chrome photographs the stage, ffmpeg turns the frames into an mp4 -
# the same two steps the command line takes, so a clip rendered here and a clip
# rendered on a laptop are the same file.
#
# The Playwright image is used because getting Chrome's shared libraries right
# on a bare Debian is a day of work that this image has already done.
FROM mcr.microsoft.com/playwright:v1.49.0-jammy

# Chrome is in the image; ffmpeg is not guaranteed to be, and a render that
# gets all the way to encoding before failing wastes the whole minute.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies first, so editing a screen does not reinstall node_modules.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# The service serves the stage to Chrome over localhost, so it needs the
# screens, the kit and the stage itself - not just the worker.
COPY src ./src
COPY screens ./screens
COPY stage ./stage
COPY kit ./kit
COPY worker ./worker

ENV PORT=8787
EXPOSE 8787

# A host that restarts unhealthy containers needs something to ask.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "worker/server.js"]
