class Business {
  constructor({ room, media, view, socketBuilder, peerBuilder }) {
    this.room = room;
    this.media = media;
    this.view = view;

    this.socketBuilder = socketBuilder;
    this.peerBuilder = peerBuilder;

    this.socket = {};
    this.currentStream = {};
    this.currentPeer = {};

    this.peersMap = new Map();
    this.userRecordingsMap = new Map();
  }

  static initialize(deps) {
    const instance = new Business(deps);
    return instance._init();
  }

  async _init() {
    this.view.configRecordButton(this.onRecordPressed.bind(this));
    this.view.configLeaveButton(this.onLeavePressed.bind(this));

    // se quiser audio, não esquecer de passar true em getCamera
    this.currentStream = await this.media.getCamera();

    this.socket = this.socketBuilder
      .setOnUserConnected(this.onSocketUserConnected())
      .setOnUserDisconnected(this.onSocketUserDisconnected())
      .build();

    this.currentPeer = await this.peerBuilder
      .setOnError(this.onPeerError())
      .setOnConnectionOpened(this.onPeerConnectionOpened())
      .setOnCallReceived(this.onPeerCallReceived())
      .setOnPeerStreamReceived(this.onPeerStreamReceived())
      .setOnCallError(this.onPeerCallError())
      .setOnCallClose(this.onPeerCallClose())
      .build();

    //currentPeer sou eu!
    this.addVideoStream(this.currentPeer.id);
  }

  addVideoStream(userId, stream = this.currentStream) {
    const recorderInstance = new Recorder(userId, stream);
    this.userRecordingsMap.set(recorderInstance.filename, recorderInstance);

    // só começa a gravar quando alguem entra!
    // pelo motivo que esta variavel está false ao iniciar a tela
    // ativando o btn, quando inserir um vídeo ele começa a gravar
    if (this.recordingEnabled) {
      recorderInstance.startRecording();
    }

    const isCurrentId = userId == this.currentPeer.id;
    this.view.renderVideo({
      userId,
      stream,
      isCurrentId,
    });
  }

  //////////////////////////////////////////////
  // Socket
  onSocketUserConnected() {
    return (userId) => {
      console.log("Socket Conectado :)", userId);
      console.log("Peer fazendo chamada, sou", userId);
      this.currentPeer.call(userId, this.currentStream);
    };
  }

  onSocketUserDisconnected() {
    return (userId) => {
      console.log("Socket Desconectado :(", userId);
      if (this.peersMap.has(userId)) {
        this.peersMap.get(userId).call.close();
        this.peersMap.delete(userId);
      }

      this.view.setParticipants(this.peersMap.size);
      this.stopRecording(userId);
      this.view.removeVideoElement(userId);
    };
  }

  //////////////////////////////////////////////
  // Peer
  onPeerError() {
    return (error) => {
      console.error("erro no peer!", error.message);
    };
  }

  onPeerConnectionOpened() {
    return (peer) => {
      const id = peer.id;
      console.log("Conectei no Peer!", peer);
      this.socket.emit("join-room", this.room, id);
    };
  }

  onPeerCallReceived() {
    return (call) => {
      console.log("Peer recebendo chamada de ", call);
      call.answer(this.currentStream);
    };
  }

  onPeerStreamReceived() {
    return (call, stream) => {
      const callerId = call.peer;

      // na versão atual do peer ele acha q audio e vídeo são
      // duas conexões, isso faz com que exiba 2 vídeos para o
      // mesmo peer... A seguir o que faz para corrigir
      // link da issue: https://github.com/peers/peerjs/issues/609
      if (this.peersMap.has(callerId)) {
        console.log("estão me chamando duas vezes, ignora a segunda!", callerId);
        return;
      }

      console.log("Peer quem me chamou", callerId, "criar video para ele");
      this.addVideoStream(callerId, stream);

      this.peersMap.set(callerId, { call });
      this.view.setParticipants(this.peersMap.size);
    };
  }

  onPeerCallError() {
    return (call, error) => {
      const clientId = call.peer;
      console.log("Peer error na call", clientId, error);
      this.view.removeVideoElement(clientId);
    };
  }

  onPeerCallClose() {
    return (call) => {
      const clientId = call.peer;
      console.log("Peer fechou", clientId);
    };
  }

  //////////////////////////////////////////////
  // Sair da tela
  onLeavePressed() {
    this.userRecordingsMap.forEach((value, key) => value.download());
  }
  //////////////////////////////////////////////
  // Gravação do vídeo
  onRecordPressed(recordingEnabled) {
    this.recordingEnabled = recordingEnabled;
    console.log("pressionou Record! :)", this.recordingEnabled);

    // varre todos os usuários e começa a gravação
    for (const [key, value] of this.userRecordingsMap) {
      if (this.recordingEnabled) {
        value.startRecording();
        continue;
      }
      this.stopRecording(key);
    }
  }

  // se entrar e sair da call durante a gravação
  // precisamos parar todas as gravações dele
  async stopRecording(fileName) {
    const mapUserRecording = this.userRecordingsMap;
    for (const [key, value] of mapUserRecording) {
      const isContextUser = key.includes(fileName);
      if (!isContextUser) {
        continue;
      }
      const rec = value;
      const isRecordingActive = rec.recordingActive;
      if (!isRecordingActive) {
        continue;
      }
      await rec.stopRecording();
      this.playRecording(key);
    }
  }

  playRecording(userId) {
    const user = this.userRecordingsMap.get(userId);
    const videoURLs = user.getAllVideosURLs();
    videoURLs.map((url) => {
      this.view.renderVideo({ url, userId });
    });
  }
}
