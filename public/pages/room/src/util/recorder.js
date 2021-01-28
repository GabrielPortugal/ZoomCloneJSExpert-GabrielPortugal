class Recorder {
  constructor(userName, stream) {
    this.userName = userName;
    this.stream = stream;
    this.filename = `id:${userName}-when:${Date.now()}`;
    this.videoType = "video/webm";

    this.mediaRecorder = {};
    this.recorderBlobs = [];
    this.completeRecordings = [];
    this.recordingActive = false;
  }

  _setup() {
    const commonCodecs = ["codecs=vp9,opus", "codecs=vp8,opus", ""];
    const options = commonCodecs
      .map((codec) => ({
        mimeType: `${this.videoType};${codec}`,
      }))
      .find((options) => MediaRecorder.isTypeSupported(options.mimeType));

    if (!options) {
      throw new Error("Não há codecs suportado. Testado:", commonCodecs);
    }

    return options;
  }

  startRecording() {
    console.log("gravar!", this.userName, this.filename);
    const options = this._setup();
    // se não estiver recebendo vídeo, nem grava
    if (!this.stream.active) {
      return;
    }
    this.mediaRecorder = new MediaRecorder(this.stream, options);

    this.mediaRecorder.onstop = (event) => {
      console.log(
        "Media Recorder, onStop - Blobs recorder",
        this.recorderBlobs
      );
    };

    this.mediaRecorder.ondataavailable = (event) => {
      if (!event.data || !event.data.size) {
        return;
      }
      this.recorderBlobs.push(event.data);
    };

    this.mediaRecorder.start();
    console.log("Media Recorder começou a gravar", this.mediaRecorder);
    this.recordingActive = true;
  }

  async stopRecording() {
    if (!this.recordingActive) {
      console.log("this.recordingActive false", this.recordingActive);
      return;
    }
    if (this.mediaRecorder.state === "inactive") {
      return;
    }

    console.log("Media Recorder parou!", this.userName);
    this.mediaRecorder.stop();
    this.recordingActive = false;
    await Util.sleep(200);
    this.completeRecordings.push([...this.recorderBlobs]);
    console.log("Qtde completos:", this.completeRecordings.length);
    this.recorderBlobs = [];
  }

  getAllVideosURLs() {
    return this.completeRecordings.map((rec) => {
      const superBuffer = new Blob(rec, { type: this.videoType });

      return window.URL.createObjectURL(superBuffer);
    });
  }

  download() {
    if (!this.completeRecordings.length) {
      return;
    }

    for (const rec of this.completeRecordings) {
      const blob = new Blob(rec, { type: this.videoType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = "none";
      a.href = url;
      a.download = `${this.filename}.webm`;
      document.body.appendChild(a);
      a.click();
    }
  }
}
