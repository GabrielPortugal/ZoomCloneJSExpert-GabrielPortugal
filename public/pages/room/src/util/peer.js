class PeerBuilder {
  constructor({ peerConfig }) {
    this.peerConfig = peerConfig;

    const defaultFuncionValue = () => {};
    this.onError = defaultFuncionValue;
    this.onCallReceived = defaultFuncionValue;
    this.onConnectionOpened = defaultFuncionValue;
    this.onPeerStreamReceived = defaultFuncionValue;
    this.onCallError = defaultFuncionValue;
    this.onCallClose = defaultFuncionValue;
  }

  setOnCallError(fn) {
    this.onCallError = fn;
    return this;
  }

  setOnCallClose(fn) {
    this.onCallClose = fn;
    return this;
  }

  setOnError(fn) {
    this.onError = fn;
    return this;
  }

  setOnCallReceived(fn) {
    this.onCallReceived = fn;
    return this;
  }

  setOnConnectionOpened(fn) {
    this.onConnectionOpened = fn;
    return this;
  }

  setOnPeerStreamReceived(fn) {
    this.onPeerStreamReceived = fn;
    return this;
  }

  _prepareCallEvent(call) {
    call.on("stream", (stream) => {
      this.onPeerStreamReceived(call, stream);
    });
    call.on("error", (error) => {
      this.onCallError(call, error);
    });
    call.on("close", (_) => {
      this.onCallClose(call);
    });
    this.onCallReceived(call);
  }

  // add o comportamento dos eventos de call também para quem ligar! (no caso eu)
  _preparePeerInstanceFunction(peerModule) {
    class PeerCustomModule extends peerModule {}

    const peerCall = PeerCustomModule.prototype.call;
    const context = this;
    PeerCustomModule.prototype.call = function (id, stream) {
      const call = peerCall.apply(this, [id, stream]);
      // aqui acontece a magia, interceptamos o call e add todos os eventos
      // da chamada para quem liga também (no caso eu)
      context._prepareCallEvent(call);

      return call;
    };

    return PeerCustomModule;
  }

  build() {
    // const peer = new Peer(...this.peerConfig);
    // sobre escreve o call do peer
    const PeerCustomInstance = this._preparePeerInstanceFunction(Peer);
    const peer = new PeerCustomInstance(...this.peerConfig);

    peer.on("error", this.onError);
    peer.on("call", this._prepareCallEvent.bind(this));

    return new Promise((resolve) =>
      peer.on("open", (id) => {
        this.onConnectionOpened(peer);
        return resolve(peer);
      })
    );
  }
}
