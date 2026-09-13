var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, { get: (a, b) => (typeof require !== "undefined" ? require : a)[b] }) : x)(function(x) {
	if (typeof require !== "undefined") return require.apply(this, arguments);
	throw Error("Calling `require` for \"" + x + "\" in an environment that doesn't expose the `require` function. See https://rolldown.rs/in-depth/bundling-cjs#require-external-modules for more details.");
});
/*!

JSZip v3.10.1 - A JavaScript class for generating and reading zip files
<http://stuartk.com/jszip>

(c) 2009-2016 Stuart Knightley <stuart [at] stuartk.com>
Dual licenced under the MIT license or GPLv3. See https://raw.github.com/Stuk/jszip/main/LICENSE.markdown.

JSZip uses the library pako released under the MIT license :
https://github.com/nodeca/pako/blob/main/LICENSE
*/
(/* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(e) {
		if ("object" == typeof exports && "undefined" != typeof module) module.exports = e();
		else if ("function" == typeof define && define.amd) define([], e);
		else ("undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : this).JSZip = e();
	})(function() {
		return function s(a, o, h) {
			function u(r, e) {
				if (!o[r]) {
					if (!a[r]) {
						var t = "function" == typeof __require && __require;
						if (!e && t) return t(r, !0);
						if (l) return l(r, !0);
						var n = /* @__PURE__ */ new Error("Cannot find module '" + r + "'");
						throw n.code = "MODULE_NOT_FOUND", n;
					}
					var i = o[r] = { exports: {} };
					a[r][0].call(i.exports, function(e) {
						var t = a[r][1][e];
						return u(t || e);
					}, i, i.exports, s, a, o, h);
				}
				return o[r].exports;
			}
			for (var l = "function" == typeof __require && __require, e = 0; e < h.length; e++) u(h[e]);
			return u;
		}({
			1: [function(e, t, r) {
				"use strict";
				var d = e("./utils"), c = e("./support"), p = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
				r.encode = function(e) {
					for (var t, r, n, i, s, a, o, h = [], u = 0, l = e.length, f = l, c = "string" !== d.getTypeOf(e); u < e.length;) f = l - u, n = c ? (t = e[u++], r = u < l ? e[u++] : 0, u < l ? e[u++] : 0) : (t = e.charCodeAt(u++), r = u < l ? e.charCodeAt(u++) : 0, u < l ? e.charCodeAt(u++) : 0), i = t >> 2, s = (3 & t) << 4 | r >> 4, a = 1 < f ? (15 & r) << 2 | n >> 6 : 64, o = 2 < f ? 63 & n : 64, h.push(p.charAt(i) + p.charAt(s) + p.charAt(a) + p.charAt(o));
					return h.join("");
				}, r.decode = function(e) {
					var t, r, n, i, s, a, o = 0, h = 0, u = "data:";
					if (e.substr(0, u.length) === u) throw new Error("Invalid base64 input, it looks like a data url.");
					var l, f = 3 * (e = e.replace(/[^A-Za-z0-9+/=]/g, "")).length / 4;
					if (e.charAt(e.length - 1) === p.charAt(64) && f--, e.charAt(e.length - 2) === p.charAt(64) && f--, f % 1 != 0) throw new Error("Invalid base64 input, bad content length.");
					for (l = c.uint8array ? new Uint8Array(0 | f) : new Array(0 | f); o < e.length;) t = p.indexOf(e.charAt(o++)) << 2 | (i = p.indexOf(e.charAt(o++))) >> 4, r = (15 & i) << 4 | (s = p.indexOf(e.charAt(o++))) >> 2, n = (3 & s) << 6 | (a = p.indexOf(e.charAt(o++))), l[h++] = t, 64 !== s && (l[h++] = r), 64 !== a && (l[h++] = n);
					return l;
				};
			}, {
				"./support": 30,
				"./utils": 32
			}],
			2: [function(e, t, r) {
				"use strict";
				var n = e("./external"), i = e("./stream/DataWorker"), s = e("./stream/Crc32Probe"), a = e("./stream/DataLengthProbe");
				function o(e, t, r, n, i) {
					this.compressedSize = e, this.uncompressedSize = t, this.crc32 = r, this.compression = n, this.compressedContent = i;
				}
				o.prototype = {
					getContentWorker: function() {
						var e = new i(n.Promise.resolve(this.compressedContent)).pipe(this.compression.uncompressWorker()).pipe(new a("data_length")), t = this;
						return e.on("end", function() {
							if (this.streamInfo.data_length !== t.uncompressedSize) throw new Error("Bug : uncompressed data size mismatch");
						}), e;
					},
					getCompressedWorker: function() {
						return new i(n.Promise.resolve(this.compressedContent)).withStreamInfo("compressedSize", this.compressedSize).withStreamInfo("uncompressedSize", this.uncompressedSize).withStreamInfo("crc32", this.crc32).withStreamInfo("compression", this.compression);
					}
				}, o.createWorkerFrom = function(e, t, r) {
					return e.pipe(new s()).pipe(new a("uncompressedSize")).pipe(t.compressWorker(r)).pipe(new a("compressedSize")).withStreamInfo("compression", t);
				}, t.exports = o;
			}, {
				"./external": 6,
				"./stream/Crc32Probe": 25,
				"./stream/DataLengthProbe": 26,
				"./stream/DataWorker": 27
			}],
			3: [function(e, t, r) {
				"use strict";
				var n = e("./stream/GenericWorker");
				r.STORE = {
					magic: "\0\0",
					compressWorker: function() {
						return new n("STORE compression");
					},
					uncompressWorker: function() {
						return new n("STORE decompression");
					}
				}, r.DEFLATE = e("./flate");
			}, {
				"./flate": 7,
				"./stream/GenericWorker": 28
			}],
			4: [function(e, t, r) {
				"use strict";
				var n = e("./utils");
				var o = function() {
					for (var e, t = [], r = 0; r < 256; r++) {
						e = r;
						for (var n = 0; n < 8; n++) e = 1 & e ? 3988292384 ^ e >>> 1 : e >>> 1;
						t[r] = e;
					}
					return t;
				}();
				t.exports = function(e, t) {
					return void 0 !== e && e.length ? "string" !== n.getTypeOf(e) ? function(e, t, r, n) {
						var i = o, s = n + r;
						e ^= -1;
						for (var a = n; a < s; a++) e = e >>> 8 ^ i[255 & (e ^ t[a])];
						return -1 ^ e;
					}(0 | t, e, e.length, 0) : function(e, t, r, n) {
						var i = o, s = n + r;
						e ^= -1;
						for (var a = n; a < s; a++) e = e >>> 8 ^ i[255 & (e ^ t.charCodeAt(a))];
						return -1 ^ e;
					}(0 | t, e, e.length, 0) : 0;
				};
			}, { "./utils": 32 }],
			5: [function(e, t, r) {
				"use strict";
				r.base64 = !1, r.binary = !1, r.dir = !1, r.createFolders = !0, r.date = null, r.compression = null, r.compressionOptions = null, r.comment = null, r.unixPermissions = null, r.dosPermissions = null;
			}, {}],
			6: [function(e, t, r) {
				"use strict";
				var n = null;
				n = "undefined" != typeof Promise ? Promise : e("lie"), t.exports = { Promise: n };
			}, { lie: 37 }],
			7: [function(e, t, r) {
				"use strict";
				var n = "undefined" != typeof Uint8Array && "undefined" != typeof Uint16Array && "undefined" != typeof Uint32Array, i = e("pako"), s = e("./utils"), a = e("./stream/GenericWorker"), o = n ? "uint8array" : "array";
				function h(e, t) {
					a.call(this, "FlateWorker/" + e), this._pako = null, this._pakoAction = e, this._pakoOptions = t, this.meta = {};
				}
				r.magic = "\b\0", s.inherits(h, a), h.prototype.processChunk = function(e) {
					this.meta = e.meta, null === this._pako && this._createPako(), this._pako.push(s.transformTo(o, e.data), !1);
				}, h.prototype.flush = function() {
					a.prototype.flush.call(this), null === this._pako && this._createPako(), this._pako.push([], !0);
				}, h.prototype.cleanUp = function() {
					a.prototype.cleanUp.call(this), this._pako = null;
				}, h.prototype._createPako = function() {
					this._pako = new i[this._pakoAction]({
						raw: !0,
						level: this._pakoOptions.level || -1
					});
					var t = this;
					this._pako.onData = function(e) {
						t.push({
							data: e,
							meta: t.meta
						});
					};
				}, r.compressWorker = function(e) {
					return new h("Deflate", e);
				}, r.uncompressWorker = function() {
					return new h("Inflate", {});
				};
			}, {
				"./stream/GenericWorker": 28,
				"./utils": 32,
				pako: 38
			}],
			8: [function(e, t, r) {
				"use strict";
				function A(e, t) {
					var r, n = "";
					for (r = 0; r < t; r++) n += String.fromCharCode(255 & e), e >>>= 8;
					return n;
				}
				function n(e, t, r, n, i, s) {
					var a, o, h = e.file, u = e.compression, l = s !== O.utf8encode, f = I.transformTo("string", s(h.name)), c = I.transformTo("string", O.utf8encode(h.name)), d = h.comment, p = I.transformTo("string", s(d)), m = I.transformTo("string", O.utf8encode(d)), _ = c.length !== h.name.length, g = m.length !== d.length, b = "", v = "", y = "", w = h.dir, k = h.date, x = {
						crc32: 0,
						compressedSize: 0,
						uncompressedSize: 0
					};
					t && !r || (x.crc32 = e.crc32, x.compressedSize = e.compressedSize, x.uncompressedSize = e.uncompressedSize);
					var S = 0;
					t && (S |= 8), l || !_ && !g || (S |= 2048);
					var z = 0, C = 0;
					w && (z |= 16), "UNIX" === i ? (C = 798, z |= function(e, t) {
						var r = e;
						return e || (r = t ? 16893 : 33204), (65535 & r) << 16;
					}(h.unixPermissions, w)) : (C = 20, z |= function(e) {
						return 63 & (e || 0);
					}(h.dosPermissions)), a = k.getUTCHours(), a <<= 6, a |= k.getUTCMinutes(), a <<= 5, a |= k.getUTCSeconds() / 2, o = k.getUTCFullYear() - 1980, o <<= 4, o |= k.getUTCMonth() + 1, o <<= 5, o |= k.getUTCDate(), _ && (v = A(1, 1) + A(B(f), 4) + c, b += "up" + A(v.length, 2) + v), g && (y = A(1, 1) + A(B(p), 4) + m, b += "uc" + A(y.length, 2) + y);
					var E = "";
					return E += "\n\0", E += A(S, 2), E += u.magic, E += A(a, 2), E += A(o, 2), E += A(x.crc32, 4), E += A(x.compressedSize, 4), E += A(x.uncompressedSize, 4), E += A(f.length, 2), E += A(b.length, 2), {
						fileRecord: R.LOCAL_FILE_HEADER + E + f + b,
						dirRecord: R.CENTRAL_FILE_HEADER + A(C, 2) + E + A(p.length, 2) + "\0\0\0\0" + A(z, 4) + A(n, 4) + f + b + p
					};
				}
				var I = e("../utils"), i = e("../stream/GenericWorker"), O = e("../utf8"), B = e("../crc32"), R = e("../signature");
				function s(e, t, r, n) {
					i.call(this, "ZipFileWorker"), this.bytesWritten = 0, this.zipComment = t, this.zipPlatform = r, this.encodeFileName = n, this.streamFiles = e, this.accumulate = !1, this.contentBuffer = [], this.dirRecords = [], this.currentSourceOffset = 0, this.entriesCount = 0, this.currentFile = null, this._sources = [];
				}
				I.inherits(s, i), s.prototype.push = function(e) {
					var t = e.meta.percent || 0, r = this.entriesCount, n = this._sources.length;
					this.accumulate ? this.contentBuffer.push(e) : (this.bytesWritten += e.data.length, i.prototype.push.call(this, {
						data: e.data,
						meta: {
							currentFile: this.currentFile,
							percent: r ? (t + 100 * (r - n - 1)) / r : 100
						}
					}));
				}, s.prototype.openedSource = function(e) {
					this.currentSourceOffset = this.bytesWritten, this.currentFile = e.file.name;
					var t = this.streamFiles && !e.file.dir;
					if (t) {
						var r = n(e, t, !1, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
						this.push({
							data: r.fileRecord,
							meta: { percent: 0 }
						});
					} else this.accumulate = !0;
				}, s.prototype.closedSource = function(e) {
					this.accumulate = !1;
					var t = this.streamFiles && !e.file.dir, r = n(e, t, !0, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
					if (this.dirRecords.push(r.dirRecord), t) this.push({
						data: function(e) {
							return R.DATA_DESCRIPTOR + A(e.crc32, 4) + A(e.compressedSize, 4) + A(e.uncompressedSize, 4);
						}(e),
						meta: { percent: 100 }
					});
					else for (this.push({
						data: r.fileRecord,
						meta: { percent: 0 }
					}); this.contentBuffer.length;) this.push(this.contentBuffer.shift());
					this.currentFile = null;
				}, s.prototype.flush = function() {
					for (var e = this.bytesWritten, t = 0; t < this.dirRecords.length; t++) this.push({
						data: this.dirRecords[t],
						meta: { percent: 100 }
					});
					var r = this.bytesWritten - e, n = function(e, t, r, n, i) {
						var s = I.transformTo("string", i(n));
						return R.CENTRAL_DIRECTORY_END + "\0\0\0\0" + A(e, 2) + A(e, 2) + A(t, 4) + A(r, 4) + A(s.length, 2) + s;
					}(this.dirRecords.length, r, e, this.zipComment, this.encodeFileName);
					this.push({
						data: n,
						meta: { percent: 100 }
					});
				}, s.prototype.prepareNextSource = function() {
					this.previous = this._sources.shift(), this.openedSource(this.previous.streamInfo), this.isPaused ? this.previous.pause() : this.previous.resume();
				}, s.prototype.registerPrevious = function(e) {
					this._sources.push(e);
					var t = this;
					return e.on("data", function(e) {
						t.processChunk(e);
					}), e.on("end", function() {
						t.closedSource(t.previous.streamInfo), t._sources.length ? t.prepareNextSource() : t.end();
					}), e.on("error", function(e) {
						t.error(e);
					}), this;
				}, s.prototype.resume = function() {
					return !!i.prototype.resume.call(this) && (!this.previous && this._sources.length ? (this.prepareNextSource(), !0) : this.previous || this._sources.length || this.generatedError ? void 0 : (this.end(), !0));
				}, s.prototype.error = function(e) {
					var t = this._sources;
					if (!i.prototype.error.call(this, e)) return !1;
					for (var r = 0; r < t.length; r++) try {
						t[r].error(e);
					} catch (e) {}
					return !0;
				}, s.prototype.lock = function() {
					i.prototype.lock.call(this);
					for (var e = this._sources, t = 0; t < e.length; t++) e[t].lock();
				}, t.exports = s;
			}, {
				"../crc32": 4,
				"../signature": 23,
				"../stream/GenericWorker": 28,
				"../utf8": 31,
				"../utils": 32
			}],
			9: [function(e, t, r) {
				"use strict";
				var u = e("../compressions"), n = e("./ZipFileWorker");
				r.generateWorker = function(e, a, t) {
					var o = new n(a.streamFiles, t, a.platform, a.encodeFileName), h = 0;
					try {
						e.forEach(function(e, t) {
							h++;
							var r = function(e, t) {
								var r = e || t, n = u[r];
								if (!n) throw new Error(r + " is not a valid compression method !");
								return n;
							}(t.options.compression, a.compression), n = t.options.compressionOptions || a.compressionOptions || {}, i = t.dir, s = t.date;
							t._compressWorker(r, n).withStreamInfo("file", {
								name: e,
								dir: i,
								date: s,
								comment: t.comment || "",
								unixPermissions: t.unixPermissions,
								dosPermissions: t.dosPermissions
							}).pipe(o);
						}), o.entriesCount = h;
					} catch (e) {
						o.error(e);
					}
					return o;
				};
			}, {
				"../compressions": 3,
				"./ZipFileWorker": 8
			}],
			10: [function(e, t, r) {
				"use strict";
				function n() {
					if (!(this instanceof n)) return new n();
					if (arguments.length) throw new Error("The constructor with parameters has been removed in JSZip 3.0, please check the upgrade guide.");
					this.files = Object.create(null), this.comment = null, this.root = "", this.clone = function() {
						var e = new n();
						for (var t in this) "function" != typeof this[t] && (e[t] = this[t]);
						return e;
					};
				}
				(n.prototype = e("./object")).loadAsync = e("./load"), n.support = e("./support"), n.defaults = e("./defaults"), n.version = "3.10.1", n.loadAsync = function(e, t) {
					return new n().loadAsync(e, t);
				}, n.external = e("./external"), t.exports = n;
			}, {
				"./defaults": 5,
				"./external": 6,
				"./load": 11,
				"./object": 15,
				"./support": 30
			}],
			11: [function(e, t, r) {
				"use strict";
				var u = e("./utils"), i = e("./external"), n = e("./utf8"), s = e("./zipEntries"), a = e("./stream/Crc32Probe"), l = e("./nodejsUtils");
				function f(n) {
					return new i.Promise(function(e, t) {
						var r = n.decompressed.getContentWorker().pipe(new a());
						r.on("error", function(e) {
							t(e);
						}).on("end", function() {
							r.streamInfo.crc32 !== n.decompressed.crc32 ? t(/* @__PURE__ */ new Error("Corrupted zip : CRC32 mismatch")) : e();
						}).resume();
					});
				}
				t.exports = function(e, o) {
					var h = this;
					return o = u.extend(o || {}, {
						base64: !1,
						checkCRC32: !1,
						optimizedBinaryString: !1,
						createFolders: !1,
						decodeFileName: n.utf8decode
					}), l.isNode && l.isStream(e) ? i.Promise.reject(/* @__PURE__ */ new Error("JSZip can't accept a stream when loading a zip file.")) : u.prepareContent("the loaded zip file", e, !0, o.optimizedBinaryString, o.base64).then(function(e) {
						var t = new s(o);
						return t.load(e), t;
					}).then(function(e) {
						var t = [i.Promise.resolve(e)], r = e.files;
						if (o.checkCRC32) for (var n = 0; n < r.length; n++) t.push(f(r[n]));
						return i.Promise.all(t);
					}).then(function(e) {
						for (var t = e.shift(), r = t.files, n = 0; n < r.length; n++) {
							var i = r[n], s = i.fileNameStr, a = u.resolve(i.fileNameStr);
							h.file(a, i.decompressed, {
								binary: !0,
								optimizedBinaryString: !0,
								date: i.date,
								dir: i.dir,
								comment: i.fileCommentStr.length ? i.fileCommentStr : null,
								unixPermissions: i.unixPermissions,
								dosPermissions: i.dosPermissions,
								createFolders: o.createFolders
							}), i.dir || (h.file(a).unsafeOriginalName = s);
						}
						return t.zipComment.length && (h.comment = t.zipComment), h;
					});
				};
			}, {
				"./external": 6,
				"./nodejsUtils": 14,
				"./stream/Crc32Probe": 25,
				"./utf8": 31,
				"./utils": 32,
				"./zipEntries": 33
			}],
			12: [function(e, t, r) {
				"use strict";
				var n = e("../utils"), i = e("../stream/GenericWorker");
				function s(e, t) {
					i.call(this, "Nodejs stream input adapter for " + e), this._upstreamEnded = !1, this._bindStream(t);
				}
				n.inherits(s, i), s.prototype._bindStream = function(e) {
					var t = this;
					(this._stream = e).pause(), e.on("data", function(e) {
						t.push({
							data: e,
							meta: { percent: 0 }
						});
					}).on("error", function(e) {
						t.isPaused ? this.generatedError = e : t.error(e);
					}).on("end", function() {
						t.isPaused ? t._upstreamEnded = !0 : t.end();
					});
				}, s.prototype.pause = function() {
					return !!i.prototype.pause.call(this) && (this._stream.pause(), !0);
				}, s.prototype.resume = function() {
					return !!i.prototype.resume.call(this) && (this._upstreamEnded ? this.end() : this._stream.resume(), !0);
				}, t.exports = s;
			}, {
				"../stream/GenericWorker": 28,
				"../utils": 32
			}],
			13: [function(e, t, r) {
				"use strict";
				var i = e("readable-stream").Readable;
				function n(e, t, r) {
					i.call(this, t), this._helper = e;
					var n = this;
					e.on("data", function(e, t) {
						n.push(e) || n._helper.pause(), r && r(t);
					}).on("error", function(e) {
						n.emit("error", e);
					}).on("end", function() {
						n.push(null);
					});
				}
				e("../utils").inherits(n, i), n.prototype._read = function() {
					this._helper.resume();
				}, t.exports = n;
			}, {
				"../utils": 32,
				"readable-stream": 16
			}],
			14: [function(e, t, r) {
				"use strict";
				t.exports = {
					isNode: "undefined" != typeof Buffer,
					newBufferFrom: function(e, t) {
						if (Buffer.from && Buffer.from !== Uint8Array.from) return Buffer.from(e, t);
						if ("number" == typeof e) throw new Error("The \"data\" argument must not be a number");
						return new Buffer(e, t);
					},
					allocBuffer: function(e) {
						if (Buffer.alloc) return Buffer.alloc(e);
						var t = new Buffer(e);
						return t.fill(0), t;
					},
					isBuffer: function(e) {
						return Buffer.isBuffer(e);
					},
					isStream: function(e) {
						return e && "function" == typeof e.on && "function" == typeof e.pause && "function" == typeof e.resume;
					}
				};
			}, {}],
			15: [function(e, t, r) {
				"use strict";
				function s(e, t, r) {
					var n, i = u.getTypeOf(t), s = u.extend(r || {}, f);
					s.date = s.date || /* @__PURE__ */ new Date(), null !== s.compression && (s.compression = s.compression.toUpperCase()), "string" == typeof s.unixPermissions && (s.unixPermissions = parseInt(s.unixPermissions, 8)), s.unixPermissions && 16384 & s.unixPermissions && (s.dir = !0), s.dosPermissions && 16 & s.dosPermissions && (s.dir = !0), s.dir && (e = g(e)), s.createFolders && (n = _(e)) && b.call(this, n, !0);
					var a = "string" === i && !1 === s.binary && !1 === s.base64;
					r && void 0 !== r.binary || (s.binary = !a), (t instanceof c && 0 === t.uncompressedSize || s.dir || !t || 0 === t.length) && (s.base64 = !1, s.binary = !0, t = "", s.compression = "STORE", i = "string");
					var o = null;
					o = t instanceof c || t instanceof l ? t : p.isNode && p.isStream(t) ? new m(e, t) : u.prepareContent(e, t, s.binary, s.optimizedBinaryString, s.base64);
					var h = new d(e, o, s);
					this.files[e] = h;
				}
				var i = e("./utf8"), u = e("./utils"), l = e("./stream/GenericWorker"), a = e("./stream/StreamHelper"), f = e("./defaults"), c = e("./compressedObject"), d = e("./zipObject"), o = e("./generate"), p = e("./nodejsUtils"), m = e("./nodejs/NodejsStreamInputAdapter"), _ = function(e) {
					"/" === e.slice(-1) && (e = e.substring(0, e.length - 1));
					var t = e.lastIndexOf("/");
					return 0 < t ? e.substring(0, t) : "";
				}, g = function(e) {
					return "/" !== e.slice(-1) && (e += "/"), e;
				}, b = function(e, t) {
					return t = void 0 !== t ? t : f.createFolders, e = g(e), this.files[e] || s.call(this, e, null, {
						dir: !0,
						createFolders: t
					}), this.files[e];
				};
				function h(e) {
					return "[object RegExp]" === Object.prototype.toString.call(e);
				}
				t.exports = {
					load: function() {
						throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
					},
					forEach: function(e) {
						var t, r, n;
						for (t in this.files) n = this.files[t], (r = t.slice(this.root.length, t.length)) && t.slice(0, this.root.length) === this.root && e(r, n);
					},
					filter: function(r) {
						var n = [];
						return this.forEach(function(e, t) {
							r(e, t) && n.push(t);
						}), n;
					},
					file: function(e, t, r) {
						if (1 !== arguments.length) return e = this.root + e, s.call(this, e, t, r), this;
						if (h(e)) {
							var n = e;
							return this.filter(function(e, t) {
								return !t.dir && n.test(e);
							});
						}
						var i = this.files[this.root + e];
						return i && !i.dir ? i : null;
					},
					folder: function(r) {
						if (!r) return this;
						if (h(r)) return this.filter(function(e, t) {
							return t.dir && r.test(e);
						});
						var e = this.root + r, t = b.call(this, e), n = this.clone();
						return n.root = t.name, n;
					},
					remove: function(r) {
						r = this.root + r;
						var e = this.files[r];
						if (e || ("/" !== r.slice(-1) && (r += "/"), e = this.files[r]), e && !e.dir) delete this.files[r];
						else for (var t = this.filter(function(e, t) {
							return t.name.slice(0, r.length) === r;
						}), n = 0; n < t.length; n++) delete this.files[t[n].name];
						return this;
					},
					generate: function() {
						throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
					},
					generateInternalStream: function(e) {
						var t, r = {};
						try {
							if ((r = u.extend(e || {}, {
								streamFiles: !1,
								compression: "STORE",
								compressionOptions: null,
								type: "",
								platform: "DOS",
								comment: null,
								mimeType: "application/zip",
								encodeFileName: i.utf8encode
							})).type = r.type.toLowerCase(), r.compression = r.compression.toUpperCase(), "binarystring" === r.type && (r.type = "string"), !r.type) throw new Error("No output type specified.");
							u.checkSupport(r.type), "darwin" !== r.platform && "freebsd" !== r.platform && "linux" !== r.platform && "sunos" !== r.platform || (r.platform = "UNIX"), "win32" === r.platform && (r.platform = "DOS");
							var n = r.comment || this.comment || "";
							t = o.generateWorker(this, r, n);
						} catch (e) {
							(t = new l("error")).error(e);
						}
						return new a(t, r.type || "string", r.mimeType);
					},
					generateAsync: function(e, t) {
						return this.generateInternalStream(e).accumulate(t);
					},
					generateNodeStream: function(e, t) {
						return (e = e || {}).type || (e.type = "nodebuffer"), this.generateInternalStream(e).toNodejsStream(t);
					}
				};
			}, {
				"./compressedObject": 2,
				"./defaults": 5,
				"./generate": 9,
				"./nodejs/NodejsStreamInputAdapter": 12,
				"./nodejsUtils": 14,
				"./stream/GenericWorker": 28,
				"./stream/StreamHelper": 29,
				"./utf8": 31,
				"./utils": 32,
				"./zipObject": 35
			}],
			16: [function(e, t, r) {
				"use strict";
				t.exports = e("stream");
			}, { stream: void 0 }],
			17: [function(e, t, r) {
				"use strict";
				var n = e("./DataReader");
				function i(e) {
					n.call(this, e);
					for (var t = 0; t < this.data.length; t++) e[t] = 255 & e[t];
				}
				e("../utils").inherits(i, n), i.prototype.byteAt = function(e) {
					return this.data[this.zero + e];
				}, i.prototype.lastIndexOfSignature = function(e) {
					for (var t = e.charCodeAt(0), r = e.charCodeAt(1), n = e.charCodeAt(2), i = e.charCodeAt(3), s = this.length - 4; 0 <= s; --s) if (this.data[s] === t && this.data[s + 1] === r && this.data[s + 2] === n && this.data[s + 3] === i) return s - this.zero;
					return -1;
				}, i.prototype.readAndCheckSignature = function(e) {
					var t = e.charCodeAt(0), r = e.charCodeAt(1), n = e.charCodeAt(2), i = e.charCodeAt(3), s = this.readData(4);
					return t === s[0] && r === s[1] && n === s[2] && i === s[3];
				}, i.prototype.readData = function(e) {
					if (this.checkOffset(e), 0 === e) return [];
					var t = this.data.slice(this.zero + this.index, this.zero + this.index + e);
					return this.index += e, t;
				}, t.exports = i;
			}, {
				"../utils": 32,
				"./DataReader": 18
			}],
			18: [function(e, t, r) {
				"use strict";
				var n = e("../utils");
				function i(e) {
					this.data = e, this.length = e.length, this.index = 0, this.zero = 0;
				}
				i.prototype = {
					checkOffset: function(e) {
						this.checkIndex(this.index + e);
					},
					checkIndex: function(e) {
						if (this.length < this.zero + e || e < 0) throw new Error("End of data reached (data length = " + this.length + ", asked index = " + e + "). Corrupted zip ?");
					},
					setIndex: function(e) {
						this.checkIndex(e), this.index = e;
					},
					skip: function(e) {
						this.setIndex(this.index + e);
					},
					byteAt: function() {},
					readInt: function(e) {
						var t, r = 0;
						for (this.checkOffset(e), t = this.index + e - 1; t >= this.index; t--) r = (r << 8) + this.byteAt(t);
						return this.index += e, r;
					},
					readString: function(e) {
						return n.transformTo("string", this.readData(e));
					},
					readData: function() {},
					lastIndexOfSignature: function() {},
					readAndCheckSignature: function() {},
					readDate: function() {
						var e = this.readInt(4);
						return new Date(Date.UTC(1980 + (e >> 25 & 127), (e >> 21 & 15) - 1, e >> 16 & 31, e >> 11 & 31, e >> 5 & 63, (31 & e) << 1));
					}
				}, t.exports = i;
			}, { "../utils": 32 }],
			19: [function(e, t, r) {
				"use strict";
				var n = e("./Uint8ArrayReader");
				function i(e) {
					n.call(this, e);
				}
				e("../utils").inherits(i, n), i.prototype.readData = function(e) {
					this.checkOffset(e);
					var t = this.data.slice(this.zero + this.index, this.zero + this.index + e);
					return this.index += e, t;
				}, t.exports = i;
			}, {
				"../utils": 32,
				"./Uint8ArrayReader": 21
			}],
			20: [function(e, t, r) {
				"use strict";
				var n = e("./DataReader");
				function i(e) {
					n.call(this, e);
				}
				e("../utils").inherits(i, n), i.prototype.byteAt = function(e) {
					return this.data.charCodeAt(this.zero + e);
				}, i.prototype.lastIndexOfSignature = function(e) {
					return this.data.lastIndexOf(e) - this.zero;
				}, i.prototype.readAndCheckSignature = function(e) {
					return e === this.readData(4);
				}, i.prototype.readData = function(e) {
					this.checkOffset(e);
					var t = this.data.slice(this.zero + this.index, this.zero + this.index + e);
					return this.index += e, t;
				}, t.exports = i;
			}, {
				"../utils": 32,
				"./DataReader": 18
			}],
			21: [function(e, t, r) {
				"use strict";
				var n = e("./ArrayReader");
				function i(e) {
					n.call(this, e);
				}
				e("../utils").inherits(i, n), i.prototype.readData = function(e) {
					if (this.checkOffset(e), 0 === e) return /* @__PURE__ */ new Uint8Array(0);
					var t = this.data.subarray(this.zero + this.index, this.zero + this.index + e);
					return this.index += e, t;
				}, t.exports = i;
			}, {
				"../utils": 32,
				"./ArrayReader": 17
			}],
			22: [function(e, t, r) {
				"use strict";
				var n = e("../utils"), i = e("../support"), s = e("./ArrayReader"), a = e("./StringReader"), o = e("./NodeBufferReader"), h = e("./Uint8ArrayReader");
				t.exports = function(e) {
					var t = n.getTypeOf(e);
					return n.checkSupport(t), "string" !== t || i.uint8array ? "nodebuffer" === t ? new o(e) : i.uint8array ? new h(n.transformTo("uint8array", e)) : new s(n.transformTo("array", e)) : new a(e);
				};
			}, {
				"../support": 30,
				"../utils": 32,
				"./ArrayReader": 17,
				"./NodeBufferReader": 19,
				"./StringReader": 20,
				"./Uint8ArrayReader": 21
			}],
			23: [function(e, t, r) {
				"use strict";
				r.LOCAL_FILE_HEADER = "PK", r.CENTRAL_FILE_HEADER = "PK", r.CENTRAL_DIRECTORY_END = "PK", r.ZIP64_CENTRAL_DIRECTORY_LOCATOR = "PK\x07", r.ZIP64_CENTRAL_DIRECTORY_END = "PK", r.DATA_DESCRIPTOR = "PK\x07\b";
			}, {}],
			24: [function(e, t, r) {
				"use strict";
				var n = e("./GenericWorker"), i = e("../utils");
				function s(e) {
					n.call(this, "ConvertWorker to " + e), this.destType = e;
				}
				i.inherits(s, n), s.prototype.processChunk = function(e) {
					this.push({
						data: i.transformTo(this.destType, e.data),
						meta: e.meta
					});
				}, t.exports = s;
			}, {
				"../utils": 32,
				"./GenericWorker": 28
			}],
			25: [function(e, t, r) {
				"use strict";
				var n = e("./GenericWorker"), i = e("../crc32");
				function s() {
					n.call(this, "Crc32Probe"), this.withStreamInfo("crc32", 0);
				}
				e("../utils").inherits(s, n), s.prototype.processChunk = function(e) {
					this.streamInfo.crc32 = i(e.data, this.streamInfo.crc32 || 0), this.push(e);
				}, t.exports = s;
			}, {
				"../crc32": 4,
				"../utils": 32,
				"./GenericWorker": 28
			}],
			26: [function(e, t, r) {
				"use strict";
				var n = e("../utils"), i = e("./GenericWorker");
				function s(e) {
					i.call(this, "DataLengthProbe for " + e), this.propName = e, this.withStreamInfo(e, 0);
				}
				n.inherits(s, i), s.prototype.processChunk = function(e) {
					if (e) {
						var t = this.streamInfo[this.propName] || 0;
						this.streamInfo[this.propName] = t + e.data.length;
					}
					i.prototype.processChunk.call(this, e);
				}, t.exports = s;
			}, {
				"../utils": 32,
				"./GenericWorker": 28
			}],
			27: [function(e, t, r) {
				"use strict";
				var n = e("../utils"), i = e("./GenericWorker");
				function s(e) {
					i.call(this, "DataWorker");
					var t = this;
					this.dataIsReady = !1, this.index = 0, this.max = 0, this.data = null, this.type = "", this._tickScheduled = !1, e.then(function(e) {
						t.dataIsReady = !0, t.data = e, t.max = e && e.length || 0, t.type = n.getTypeOf(e), t.isPaused || t._tickAndRepeat();
					}, function(e) {
						t.error(e);
					});
				}
				n.inherits(s, i), s.prototype.cleanUp = function() {
					i.prototype.cleanUp.call(this), this.data = null;
				}, s.prototype.resume = function() {
					return !!i.prototype.resume.call(this) && (!this._tickScheduled && this.dataIsReady && (this._tickScheduled = !0, n.delay(this._tickAndRepeat, [], this)), !0);
				}, s.prototype._tickAndRepeat = function() {
					this._tickScheduled = !1, this.isPaused || this.isFinished || (this._tick(), this.isFinished || (n.delay(this._tickAndRepeat, [], this), this._tickScheduled = !0));
				}, s.prototype._tick = function() {
					if (this.isPaused || this.isFinished) return !1;
					var e = null, t = Math.min(this.max, this.index + 16384);
					if (this.index >= this.max) return this.end();
					switch (this.type) {
						case "string":
							e = this.data.substring(this.index, t);
							break;
						case "uint8array":
							e = this.data.subarray(this.index, t);
							break;
						case "array":
						case "nodebuffer": e = this.data.slice(this.index, t);
					}
					return this.index = t, this.push({
						data: e,
						meta: { percent: this.max ? this.index / this.max * 100 : 0 }
					});
				}, t.exports = s;
			}, {
				"../utils": 32,
				"./GenericWorker": 28
			}],
			28: [function(e, t, r) {
				"use strict";
				function n(e) {
					this.name = e || "default", this.streamInfo = {}, this.generatedError = null, this.extraStreamInfo = {}, this.isPaused = !0, this.isFinished = !1, this.isLocked = !1, this._listeners = {
						data: [],
						end: [],
						error: []
					}, this.previous = null;
				}
				n.prototype = {
					push: function(e) {
						this.emit("data", e);
					},
					end: function() {
						if (this.isFinished) return !1;
						this.flush();
						try {
							this.emit("end"), this.cleanUp(), this.isFinished = !0;
						} catch (e) {
							this.emit("error", e);
						}
						return !0;
					},
					error: function(e) {
						return !this.isFinished && (this.isPaused ? this.generatedError = e : (this.isFinished = !0, this.emit("error", e), this.previous && this.previous.error(e), this.cleanUp()), !0);
					},
					on: function(e, t) {
						return this._listeners[e].push(t), this;
					},
					cleanUp: function() {
						this.streamInfo = this.generatedError = this.extraStreamInfo = null, this._listeners = [];
					},
					emit: function(e, t) {
						if (this._listeners[e]) for (var r = 0; r < this._listeners[e].length; r++) this._listeners[e][r].call(this, t);
					},
					pipe: function(e) {
						return e.registerPrevious(this);
					},
					registerPrevious: function(e) {
						if (this.isLocked) throw new Error("The stream '" + this + "' has already been used.");
						this.streamInfo = e.streamInfo, this.mergeStreamInfo(), this.previous = e;
						var t = this;
						return e.on("data", function(e) {
							t.processChunk(e);
						}), e.on("end", function() {
							t.end();
						}), e.on("error", function(e) {
							t.error(e);
						}), this;
					},
					pause: function() {
						return !this.isPaused && !this.isFinished && (this.isPaused = !0, this.previous && this.previous.pause(), !0);
					},
					resume: function() {
						if (!this.isPaused || this.isFinished) return !1;
						var e = this.isPaused = !1;
						return this.generatedError && (this.error(this.generatedError), e = !0), this.previous && this.previous.resume(), !e;
					},
					flush: function() {},
					processChunk: function(e) {
						this.push(e);
					},
					withStreamInfo: function(e, t) {
						return this.extraStreamInfo[e] = t, this.mergeStreamInfo(), this;
					},
					mergeStreamInfo: function() {
						for (var e in this.extraStreamInfo) Object.prototype.hasOwnProperty.call(this.extraStreamInfo, e) && (this.streamInfo[e] = this.extraStreamInfo[e]);
					},
					lock: function() {
						if (this.isLocked) throw new Error("The stream '" + this + "' has already been used.");
						this.isLocked = !0, this.previous && this.previous.lock();
					},
					toString: function() {
						var e = "Worker " + this.name;
						return this.previous ? this.previous + " -> " + e : e;
					}
				}, t.exports = n;
			}, {}],
			29: [function(e, t, r) {
				"use strict";
				var h = e("../utils"), i = e("./ConvertWorker"), s = e("./GenericWorker"), u = e("../base64"), n = e("../support"), a = e("../external"), o = null;
				if (n.nodestream) try {
					o = e("../nodejs/NodejsStreamOutputAdapter");
				} catch (e) {}
				function l(e, o) {
					return new a.Promise(function(t, r) {
						var n = [], i = e._internalType, s = e._outputType, a = e._mimeType;
						e.on("data", function(e, t) {
							n.push(e), o && o(t);
						}).on("error", function(e) {
							n = [], r(e);
						}).on("end", function() {
							try {
								t(function(e, t, r) {
									switch (e) {
										case "blob": return h.newBlob(h.transformTo("arraybuffer", t), r);
										case "base64": return u.encode(t);
										default: return h.transformTo(e, t);
									}
								}(s, function(e, t) {
									var r, n = 0, i = null, s = 0;
									for (r = 0; r < t.length; r++) s += t[r].length;
									switch (e) {
										case "string": return t.join("");
										case "array": return Array.prototype.concat.apply([], t);
										case "uint8array":
											for (i = new Uint8Array(s), r = 0; r < t.length; r++) i.set(t[r], n), n += t[r].length;
											return i;
										case "nodebuffer": return Buffer.concat(t);
										default: throw new Error("concat : unsupported type '" + e + "'");
									}
								}(i, n), a));
							} catch (e) {
								r(e);
							}
							n = [];
						}).resume();
					});
				}
				function f(e, t, r) {
					var n = t;
					switch (t) {
						case "blob":
						case "arraybuffer":
							n = "uint8array";
							break;
						case "base64": n = "string";
					}
					try {
						this._internalType = n, this._outputType = t, this._mimeType = r, h.checkSupport(n), this._worker = e.pipe(new i(n)), e.lock();
					} catch (e) {
						this._worker = new s("error"), this._worker.error(e);
					}
				}
				f.prototype = {
					accumulate: function(e) {
						return l(this, e);
					},
					on: function(e, t) {
						var r = this;
						return "data" === e ? this._worker.on(e, function(e) {
							t.call(r, e.data, e.meta);
						}) : this._worker.on(e, function() {
							h.delay(t, arguments, r);
						}), this;
					},
					resume: function() {
						return h.delay(this._worker.resume, [], this._worker), this;
					},
					pause: function() {
						return this._worker.pause(), this;
					},
					toNodejsStream: function(e) {
						if (h.checkSupport("nodestream"), "nodebuffer" !== this._outputType) throw new Error(this._outputType + " is not supported by this method");
						return new o(this, { objectMode: "nodebuffer" !== this._outputType }, e);
					}
				}, t.exports = f;
			}, {
				"../base64": 1,
				"../external": 6,
				"../nodejs/NodejsStreamOutputAdapter": 13,
				"../support": 30,
				"../utils": 32,
				"./ConvertWorker": 24,
				"./GenericWorker": 28
			}],
			30: [function(e, t, r) {
				"use strict";
				if (r.base64 = !0, r.array = !0, r.string = !0, r.arraybuffer = "undefined" != typeof ArrayBuffer && "undefined" != typeof Uint8Array, r.nodebuffer = "undefined" != typeof Buffer, r.uint8array = "undefined" != typeof Uint8Array, "undefined" == typeof ArrayBuffer) r.blob = !1;
				else {
					var n = /* @__PURE__ */ new ArrayBuffer(0);
					try {
						r.blob = 0 === new Blob([n], { type: "application/zip" }).size;
					} catch (e) {
						try {
							var i = new (self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder)();
							i.append(n), r.blob = 0 === i.getBlob("application/zip").size;
						} catch (e) {
							r.blob = !1;
						}
					}
				}
				try {
					r.nodestream = !!e("readable-stream").Readable;
				} catch (e) {
					r.nodestream = !1;
				}
			}, { "readable-stream": 16 }],
			31: [function(e, t, s) {
				"use strict";
				for (var o = e("./utils"), h = e("./support"), r = e("./nodejsUtils"), n = e("./stream/GenericWorker"), u = new Array(256), i = 0; i < 256; i++) u[i] = 252 <= i ? 6 : 248 <= i ? 5 : 240 <= i ? 4 : 224 <= i ? 3 : 192 <= i ? 2 : 1;
				u[254] = u[254] = 1;
				function a() {
					n.call(this, "utf-8 decode"), this.leftOver = null;
				}
				function l() {
					n.call(this, "utf-8 encode");
				}
				s.utf8encode = function(e) {
					return h.nodebuffer ? r.newBufferFrom(e, "utf-8") : function(e) {
						var t, r, n, i, s, a = e.length, o = 0;
						for (i = 0; i < a; i++) 55296 == (64512 & (r = e.charCodeAt(i))) && i + 1 < a && 56320 == (64512 & (n = e.charCodeAt(i + 1))) && (r = 65536 + (r - 55296 << 10) + (n - 56320), i++), o += r < 128 ? 1 : r < 2048 ? 2 : r < 65536 ? 3 : 4;
						for (t = h.uint8array ? new Uint8Array(o) : new Array(o), i = s = 0; s < o; i++) 55296 == (64512 & (r = e.charCodeAt(i))) && i + 1 < a && 56320 == (64512 & (n = e.charCodeAt(i + 1))) && (r = 65536 + (r - 55296 << 10) + (n - 56320), i++), r < 128 ? t[s++] = r : (r < 2048 ? t[s++] = 192 | r >>> 6 : (r < 65536 ? t[s++] = 224 | r >>> 12 : (t[s++] = 240 | r >>> 18, t[s++] = 128 | r >>> 12 & 63), t[s++] = 128 | r >>> 6 & 63), t[s++] = 128 | 63 & r);
						return t;
					}(e);
				}, s.utf8decode = function(e) {
					return h.nodebuffer ? o.transformTo("nodebuffer", e).toString("utf-8") : function(e) {
						var t, r, n, i, s = e.length, a = new Array(2 * s);
						for (t = r = 0; t < s;) if ((n = e[t++]) < 128) a[r++] = n;
						else if (4 < (i = u[n])) a[r++] = 65533, t += i - 1;
						else {
							for (n &= 2 === i ? 31 : 3 === i ? 15 : 7; 1 < i && t < s;) n = n << 6 | 63 & e[t++], i--;
							1 < i ? a[r++] = 65533 : n < 65536 ? a[r++] = n : (n -= 65536, a[r++] = 55296 | n >> 10 & 1023, a[r++] = 56320 | 1023 & n);
						}
						return a.length !== r && (a.subarray ? a = a.subarray(0, r) : a.length = r), o.applyFromCharCode(a);
					}(e = o.transformTo(h.uint8array ? "uint8array" : "array", e));
				}, o.inherits(a, n), a.prototype.processChunk = function(e) {
					var t = o.transformTo(h.uint8array ? "uint8array" : "array", e.data);
					if (this.leftOver && this.leftOver.length) {
						if (h.uint8array) {
							var r = t;
							(t = new Uint8Array(r.length + this.leftOver.length)).set(this.leftOver, 0), t.set(r, this.leftOver.length);
						} else t = this.leftOver.concat(t);
						this.leftOver = null;
					}
					var n = function(e, t) {
						var r;
						for ((t = t || e.length) > e.length && (t = e.length), r = t - 1; 0 <= r && 128 == (192 & e[r]);) r--;
						return r < 0 ? t : 0 === r ? t : r + u[e[r]] > t ? r : t;
					}(t), i = t;
					n !== t.length && (h.uint8array ? (i = t.subarray(0, n), this.leftOver = t.subarray(n, t.length)) : (i = t.slice(0, n), this.leftOver = t.slice(n, t.length))), this.push({
						data: s.utf8decode(i),
						meta: e.meta
					});
				}, a.prototype.flush = function() {
					this.leftOver && this.leftOver.length && (this.push({
						data: s.utf8decode(this.leftOver),
						meta: {}
					}), this.leftOver = null);
				}, s.Utf8DecodeWorker = a, o.inherits(l, n), l.prototype.processChunk = function(e) {
					this.push({
						data: s.utf8encode(e.data),
						meta: e.meta
					});
				}, s.Utf8EncodeWorker = l;
			}, {
				"./nodejsUtils": 14,
				"./stream/GenericWorker": 28,
				"./support": 30,
				"./utils": 32
			}],
			32: [function(e, t, a) {
				"use strict";
				var o = e("./support"), h = e("./base64"), r = e("./nodejsUtils"), u = e("./external");
				function n(e) {
					return e;
				}
				function l(e, t) {
					for (var r = 0; r < e.length; ++r) t[r] = 255 & e.charCodeAt(r);
					return t;
				}
				e("setimmediate"), a.newBlob = function(t, r) {
					a.checkSupport("blob");
					try {
						return new Blob([t], { type: r });
					} catch (e) {
						try {
							var n = new (self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder)();
							return n.append(t), n.getBlob(r);
						} catch (e) {
							throw new Error("Bug : can't construct the Blob.");
						}
					}
				};
				var i = {
					stringifyByChunk: function(e, t, r) {
						var n = [], i = 0, s = e.length;
						if (s <= r) return String.fromCharCode.apply(null, e);
						for (; i < s;) "array" === t || "nodebuffer" === t ? n.push(String.fromCharCode.apply(null, e.slice(i, Math.min(i + r, s)))) : n.push(String.fromCharCode.apply(null, e.subarray(i, Math.min(i + r, s)))), i += r;
						return n.join("");
					},
					stringifyByChar: function(e) {
						for (var t = "", r = 0; r < e.length; r++) t += String.fromCharCode(e[r]);
						return t;
					},
					applyCanBeUsed: {
						uint8array: function() {
							try {
								return o.uint8array && 1 === String.fromCharCode.apply(null, /* @__PURE__ */ new Uint8Array(1)).length;
							} catch (e) {
								return !1;
							}
						}(),
						nodebuffer: function() {
							try {
								return o.nodebuffer && 1 === String.fromCharCode.apply(null, r.allocBuffer(1)).length;
							} catch (e) {
								return !1;
							}
						}()
					}
				};
				function s(e) {
					var t = 65536, r = a.getTypeOf(e), n = !0;
					if ("uint8array" === r ? n = i.applyCanBeUsed.uint8array : "nodebuffer" === r && (n = i.applyCanBeUsed.nodebuffer), n) for (; 1 < t;) try {
						return i.stringifyByChunk(e, r, t);
					} catch (e) {
						t = Math.floor(t / 2);
					}
					return i.stringifyByChar(e);
				}
				function f(e, t) {
					for (var r = 0; r < e.length; r++) t[r] = e[r];
					return t;
				}
				a.applyFromCharCode = s;
				var c = {};
				c.string = {
					string: n,
					array: function(e) {
						return l(e, new Array(e.length));
					},
					arraybuffer: function(e) {
						return c.string.uint8array(e).buffer;
					},
					uint8array: function(e) {
						return l(e, new Uint8Array(e.length));
					},
					nodebuffer: function(e) {
						return l(e, r.allocBuffer(e.length));
					}
				}, c.array = {
					string: s,
					array: n,
					arraybuffer: function(e) {
						return new Uint8Array(e).buffer;
					},
					uint8array: function(e) {
						return new Uint8Array(e);
					},
					nodebuffer: function(e) {
						return r.newBufferFrom(e);
					}
				}, c.arraybuffer = {
					string: function(e) {
						return s(new Uint8Array(e));
					},
					array: function(e) {
						return f(new Uint8Array(e), new Array(e.byteLength));
					},
					arraybuffer: n,
					uint8array: function(e) {
						return new Uint8Array(e);
					},
					nodebuffer: function(e) {
						return r.newBufferFrom(new Uint8Array(e));
					}
				}, c.uint8array = {
					string: s,
					array: function(e) {
						return f(e, new Array(e.length));
					},
					arraybuffer: function(e) {
						return e.buffer;
					},
					uint8array: n,
					nodebuffer: function(e) {
						return r.newBufferFrom(e);
					}
				}, c.nodebuffer = {
					string: s,
					array: function(e) {
						return f(e, new Array(e.length));
					},
					arraybuffer: function(e) {
						return c.nodebuffer.uint8array(e).buffer;
					},
					uint8array: function(e) {
						return f(e, new Uint8Array(e.length));
					},
					nodebuffer: n
				}, a.transformTo = function(e, t) {
					if (t = t || "", !e) return t;
					a.checkSupport(e);
					return c[a.getTypeOf(t)][e](t);
				}, a.resolve = function(e) {
					for (var t = e.split("/"), r = [], n = 0; n < t.length; n++) {
						var i = t[n];
						"." === i || "" === i && 0 !== n && n !== t.length - 1 || (".." === i ? r.pop() : r.push(i));
					}
					return r.join("/");
				}, a.getTypeOf = function(e) {
					return "string" == typeof e ? "string" : "[object Array]" === Object.prototype.toString.call(e) ? "array" : o.nodebuffer && r.isBuffer(e) ? "nodebuffer" : o.uint8array && e instanceof Uint8Array ? "uint8array" : o.arraybuffer && e instanceof ArrayBuffer ? "arraybuffer" : void 0;
				}, a.checkSupport = function(e) {
					if (!o[e.toLowerCase()]) throw new Error(e + " is not supported by this platform");
				}, a.MAX_VALUE_16BITS = 65535, a.MAX_VALUE_32BITS = -1, a.pretty = function(e) {
					var t, r, n = "";
					for (r = 0; r < (e || "").length; r++) n += "\\x" + ((t = e.charCodeAt(r)) < 16 ? "0" : "") + t.toString(16).toUpperCase();
					return n;
				}, a.delay = function(e, t, r) {
					setImmediate(function() {
						e.apply(r || null, t || []);
					});
				}, a.inherits = function(e, t) {
					function r() {}
					r.prototype = t.prototype, e.prototype = new r();
				}, a.extend = function() {
					var e, t, r = {};
					for (e = 0; e < arguments.length; e++) for (t in arguments[e]) Object.prototype.hasOwnProperty.call(arguments[e], t) && void 0 === r[t] && (r[t] = arguments[e][t]);
					return r;
				}, a.prepareContent = function(r, e, n, i, s) {
					return u.Promise.resolve(e).then(function(n) {
						return o.blob && (n instanceof Blob || -1 !== ["[object File]", "[object Blob]"].indexOf(Object.prototype.toString.call(n))) && "undefined" != typeof FileReader ? new u.Promise(function(t, r) {
							var e = new FileReader();
							e.onload = function(e) {
								t(e.target.result);
							}, e.onerror = function(e) {
								r(e.target.error);
							}, e.readAsArrayBuffer(n);
						}) : n;
					}).then(function(e) {
						var t = a.getTypeOf(e);
						return t ? ("arraybuffer" === t ? e = a.transformTo("uint8array", e) : "string" === t && (s ? e = h.decode(e) : n && !0 !== i && (e = function(e) {
							return l(e, o.uint8array ? new Uint8Array(e.length) : new Array(e.length));
						}(e))), e) : u.Promise.reject(/* @__PURE__ */ new Error("Can't read the data of '" + r + "'. Is it in a supported JavaScript type (String, Blob, ArrayBuffer, etc) ?"));
					});
				};
			}, {
				"./base64": 1,
				"./external": 6,
				"./nodejsUtils": 14,
				"./support": 30,
				setimmediate: 54
			}],
			33: [function(e, t, r) {
				"use strict";
				var n = e("./reader/readerFor"), i = e("./utils"), s = e("./signature"), a = e("./zipEntry"), o = e("./support");
				function h(e) {
					this.files = [], this.loadOptions = e;
				}
				h.prototype = {
					checkSignature: function(e) {
						if (!this.reader.readAndCheckSignature(e)) {
							this.reader.index -= 4;
							var t = this.reader.readString(4);
							throw new Error("Corrupted zip or bug: unexpected signature (" + i.pretty(t) + ", expected " + i.pretty(e) + ")");
						}
					},
					isSignature: function(e, t) {
						var r = this.reader.index;
						this.reader.setIndex(e);
						var n = this.reader.readString(4) === t;
						return this.reader.setIndex(r), n;
					},
					readBlockEndOfCentral: function() {
						this.diskNumber = this.reader.readInt(2), this.diskWithCentralDirStart = this.reader.readInt(2), this.centralDirRecordsOnThisDisk = this.reader.readInt(2), this.centralDirRecords = this.reader.readInt(2), this.centralDirSize = this.reader.readInt(4), this.centralDirOffset = this.reader.readInt(4), this.zipCommentLength = this.reader.readInt(2);
						var e = this.reader.readData(this.zipCommentLength), t = o.uint8array ? "uint8array" : "array", r = i.transformTo(t, e);
						this.zipComment = this.loadOptions.decodeFileName(r);
					},
					readBlockZip64EndOfCentral: function() {
						this.zip64EndOfCentralSize = this.reader.readInt(8), this.reader.skip(4), this.diskNumber = this.reader.readInt(4), this.diskWithCentralDirStart = this.reader.readInt(4), this.centralDirRecordsOnThisDisk = this.reader.readInt(8), this.centralDirRecords = this.reader.readInt(8), this.centralDirSize = this.reader.readInt(8), this.centralDirOffset = this.reader.readInt(8), this.zip64ExtensibleData = {};
						for (var e, t, r, n = this.zip64EndOfCentralSize - 44; 0 < n;) e = this.reader.readInt(2), t = this.reader.readInt(4), r = this.reader.readData(t), this.zip64ExtensibleData[e] = {
							id: e,
							length: t,
							value: r
						};
					},
					readBlockZip64EndOfCentralLocator: function() {
						if (this.diskWithZip64CentralDirStart = this.reader.readInt(4), this.relativeOffsetEndOfZip64CentralDir = this.reader.readInt(8), this.disksCount = this.reader.readInt(4), 1 < this.disksCount) throw new Error("Multi-volumes zip are not supported");
					},
					readLocalFiles: function() {
						var e, t;
						for (e = 0; e < this.files.length; e++) t = this.files[e], this.reader.setIndex(t.localHeaderOffset), this.checkSignature(s.LOCAL_FILE_HEADER), t.readLocalPart(this.reader), t.handleUTF8(), t.processAttributes();
					},
					readCentralDir: function() {
						var e;
						for (this.reader.setIndex(this.centralDirOffset); this.reader.readAndCheckSignature(s.CENTRAL_FILE_HEADER);) (e = new a({ zip64: this.zip64 }, this.loadOptions)).readCentralPart(this.reader), this.files.push(e);
						if (this.centralDirRecords !== this.files.length && 0 !== this.centralDirRecords && 0 === this.files.length) throw new Error("Corrupted zip or bug: expected " + this.centralDirRecords + " records in central dir, got " + this.files.length);
					},
					readEndOfCentral: function() {
						var e = this.reader.lastIndexOfSignature(s.CENTRAL_DIRECTORY_END);
						if (e < 0) throw !this.isSignature(0, s.LOCAL_FILE_HEADER) ? /* @__PURE__ */ new Error("Can't find end of central directory : is this a zip file ? If it is, see https://stuk.github.io/jszip/documentation/howto/read_zip.html") : /* @__PURE__ */ new Error("Corrupted zip: can't find end of central directory");
						this.reader.setIndex(e);
						var t = e;
						if (this.checkSignature(s.CENTRAL_DIRECTORY_END), this.readBlockEndOfCentral(), this.diskNumber === i.MAX_VALUE_16BITS || this.diskWithCentralDirStart === i.MAX_VALUE_16BITS || this.centralDirRecordsOnThisDisk === i.MAX_VALUE_16BITS || this.centralDirRecords === i.MAX_VALUE_16BITS || this.centralDirSize === i.MAX_VALUE_32BITS || this.centralDirOffset === i.MAX_VALUE_32BITS) {
							if (this.zip64 = !0, (e = this.reader.lastIndexOfSignature(s.ZIP64_CENTRAL_DIRECTORY_LOCATOR)) < 0) throw new Error("Corrupted zip: can't find the ZIP64 end of central directory locator");
							if (this.reader.setIndex(e), this.checkSignature(s.ZIP64_CENTRAL_DIRECTORY_LOCATOR), this.readBlockZip64EndOfCentralLocator(), !this.isSignature(this.relativeOffsetEndOfZip64CentralDir, s.ZIP64_CENTRAL_DIRECTORY_END) && (this.relativeOffsetEndOfZip64CentralDir = this.reader.lastIndexOfSignature(s.ZIP64_CENTRAL_DIRECTORY_END), this.relativeOffsetEndOfZip64CentralDir < 0)) throw new Error("Corrupted zip: can't find the ZIP64 end of central directory");
							this.reader.setIndex(this.relativeOffsetEndOfZip64CentralDir), this.checkSignature(s.ZIP64_CENTRAL_DIRECTORY_END), this.readBlockZip64EndOfCentral();
						}
						var r = this.centralDirOffset + this.centralDirSize;
						this.zip64 && (r += 20, r += 12 + this.zip64EndOfCentralSize);
						var n = t - r;
						if (0 < n) this.isSignature(t, s.CENTRAL_FILE_HEADER) || (this.reader.zero = n);
						else if (n < 0) throw new Error("Corrupted zip: missing " + Math.abs(n) + " bytes.");
					},
					prepareReader: function(e) {
						this.reader = n(e);
					},
					load: function(e) {
						this.prepareReader(e), this.readEndOfCentral(), this.readCentralDir(), this.readLocalFiles();
					}
				}, t.exports = h;
			}, {
				"./reader/readerFor": 22,
				"./signature": 23,
				"./support": 30,
				"./utils": 32,
				"./zipEntry": 34
			}],
			34: [function(e, t, r) {
				"use strict";
				var n = e("./reader/readerFor"), s = e("./utils"), i = e("./compressedObject"), a = e("./crc32"), o = e("./utf8"), h = e("./compressions"), u = e("./support");
				function l(e, t) {
					this.options = e, this.loadOptions = t;
				}
				l.prototype = {
					isEncrypted: function() {
						return 1 == (1 & this.bitFlag);
					},
					useUTF8: function() {
						return 2048 == (2048 & this.bitFlag);
					},
					readLocalPart: function(e) {
						var t, r;
						if (e.skip(22), this.fileNameLength = e.readInt(2), r = e.readInt(2), this.fileName = e.readData(this.fileNameLength), e.skip(r), -1 === this.compressedSize || -1 === this.uncompressedSize) throw new Error("Bug or corrupted zip : didn't get enough information from the central directory (compressedSize === -1 || uncompressedSize === -1)");
						if (null === (t = function(e) {
							for (var t in h) if (Object.prototype.hasOwnProperty.call(h, t) && h[t].magic === e) return h[t];
							return null;
						}(this.compressionMethod))) throw new Error("Corrupted zip : compression " + s.pretty(this.compressionMethod) + " unknown (inner file : " + s.transformTo("string", this.fileName) + ")");
						this.decompressed = new i(this.compressedSize, this.uncompressedSize, this.crc32, t, e.readData(this.compressedSize));
					},
					readCentralPart: function(e) {
						this.versionMadeBy = e.readInt(2), e.skip(2), this.bitFlag = e.readInt(2), this.compressionMethod = e.readString(2), this.date = e.readDate(), this.crc32 = e.readInt(4), this.compressedSize = e.readInt(4), this.uncompressedSize = e.readInt(4);
						var t = e.readInt(2);
						if (this.extraFieldsLength = e.readInt(2), this.fileCommentLength = e.readInt(2), this.diskNumberStart = e.readInt(2), this.internalFileAttributes = e.readInt(2), this.externalFileAttributes = e.readInt(4), this.localHeaderOffset = e.readInt(4), this.isEncrypted()) throw new Error("Encrypted zip are not supported");
						e.skip(t), this.readExtraFields(e), this.parseZIP64ExtraField(e), this.fileComment = e.readData(this.fileCommentLength);
					},
					processAttributes: function() {
						this.unixPermissions = null, this.dosPermissions = null;
						var e = this.versionMadeBy >> 8;
						this.dir = !!(16 & this.externalFileAttributes), 0 == e && (this.dosPermissions = 63 & this.externalFileAttributes), 3 == e && (this.unixPermissions = this.externalFileAttributes >> 16 & 65535), this.dir || "/" !== this.fileNameStr.slice(-1) || (this.dir = !0);
					},
					parseZIP64ExtraField: function() {
						if (this.extraFields[1]) {
							var e = n(this.extraFields[1].value);
							this.uncompressedSize === s.MAX_VALUE_32BITS && (this.uncompressedSize = e.readInt(8)), this.compressedSize === s.MAX_VALUE_32BITS && (this.compressedSize = e.readInt(8)), this.localHeaderOffset === s.MAX_VALUE_32BITS && (this.localHeaderOffset = e.readInt(8)), this.diskNumberStart === s.MAX_VALUE_32BITS && (this.diskNumberStart = e.readInt(4));
						}
					},
					readExtraFields: function(e) {
						var t, r, n, i = e.index + this.extraFieldsLength;
						for (this.extraFields || (this.extraFields = {}); e.index + 4 < i;) t = e.readInt(2), r = e.readInt(2), n = e.readData(r), this.extraFields[t] = {
							id: t,
							length: r,
							value: n
						};
						e.setIndex(i);
					},
					handleUTF8: function() {
						var e = u.uint8array ? "uint8array" : "array";
						if (this.useUTF8()) this.fileNameStr = o.utf8decode(this.fileName), this.fileCommentStr = o.utf8decode(this.fileComment);
						else {
							var t = this.findExtraFieldUnicodePath();
							if (null !== t) this.fileNameStr = t;
							else {
								var r = s.transformTo(e, this.fileName);
								this.fileNameStr = this.loadOptions.decodeFileName(r);
							}
							var n = this.findExtraFieldUnicodeComment();
							if (null !== n) this.fileCommentStr = n;
							else {
								var i = s.transformTo(e, this.fileComment);
								this.fileCommentStr = this.loadOptions.decodeFileName(i);
							}
						}
					},
					findExtraFieldUnicodePath: function() {
						var e = this.extraFields[28789];
						if (e) {
							var t = n(e.value);
							return 1 !== t.readInt(1) ? null : a(this.fileName) !== t.readInt(4) ? null : o.utf8decode(t.readData(e.length - 5));
						}
						return null;
					},
					findExtraFieldUnicodeComment: function() {
						var e = this.extraFields[25461];
						if (e) {
							var t = n(e.value);
							return 1 !== t.readInt(1) ? null : a(this.fileComment) !== t.readInt(4) ? null : o.utf8decode(t.readData(e.length - 5));
						}
						return null;
					}
				}, t.exports = l;
			}, {
				"./compressedObject": 2,
				"./compressions": 3,
				"./crc32": 4,
				"./reader/readerFor": 22,
				"./support": 30,
				"./utf8": 31,
				"./utils": 32
			}],
			35: [function(e, t, r) {
				"use strict";
				function n(e, t, r) {
					this.name = e, this.dir = r.dir, this.date = r.date, this.comment = r.comment, this.unixPermissions = r.unixPermissions, this.dosPermissions = r.dosPermissions, this._data = t, this._dataBinary = r.binary, this.options = {
						compression: r.compression,
						compressionOptions: r.compressionOptions
					};
				}
				var s = e("./stream/StreamHelper"), i = e("./stream/DataWorker"), a = e("./utf8"), o = e("./compressedObject"), h = e("./stream/GenericWorker");
				n.prototype = {
					internalStream: function(e) {
						var t = null, r = "string";
						try {
							if (!e) throw new Error("No output type specified.");
							var n = "string" === (r = e.toLowerCase()) || "text" === r;
							"binarystring" !== r && "text" !== r || (r = "string"), t = this._decompressWorker();
							var i = !this._dataBinary;
							i && !n && (t = t.pipe(new a.Utf8EncodeWorker())), !i && n && (t = t.pipe(new a.Utf8DecodeWorker()));
						} catch (e) {
							(t = new h("error")).error(e);
						}
						return new s(t, r, "");
					},
					async: function(e, t) {
						return this.internalStream(e).accumulate(t);
					},
					nodeStream: function(e, t) {
						return this.internalStream(e || "nodebuffer").toNodejsStream(t);
					},
					_compressWorker: function(e, t) {
						if (this._data instanceof o && this._data.compression.magic === e.magic) return this._data.getCompressedWorker();
						var r = this._decompressWorker();
						return this._dataBinary || (r = r.pipe(new a.Utf8EncodeWorker())), o.createWorkerFrom(r, e, t);
					},
					_decompressWorker: function() {
						return this._data instanceof o ? this._data.getContentWorker() : this._data instanceof h ? this._data : new i(this._data);
					}
				};
				for (var u = [
					"asText",
					"asBinary",
					"asNodeBuffer",
					"asUint8Array",
					"asArrayBuffer"
				], l = function() {
					throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
				}, f = 0; f < u.length; f++) n.prototype[u[f]] = l;
				t.exports = n;
			}, {
				"./compressedObject": 2,
				"./stream/DataWorker": 27,
				"./stream/GenericWorker": 28,
				"./stream/StreamHelper": 29,
				"./utf8": 31
			}],
			36: [function(e, l, t) {
				(function(t) {
					"use strict";
					var r, n, e = t.MutationObserver || t.WebKitMutationObserver;
					if (e) {
						var i = 0, s = new e(u), a = t.document.createTextNode("");
						s.observe(a, { characterData: !0 }), r = function() {
							a.data = i = ++i % 2;
						};
					} else if (t.setImmediate || void 0 === t.MessageChannel) r = "document" in t && "onreadystatechange" in t.document.createElement("script") ? function() {
						var e = t.document.createElement("script");
						e.onreadystatechange = function() {
							u(), e.onreadystatechange = null, e.parentNode.removeChild(e), e = null;
						}, t.document.documentElement.appendChild(e);
					} : function() {
						setTimeout(u, 0);
					};
					else {
						var o = new t.MessageChannel();
						o.port1.onmessage = u, r = function() {
							o.port2.postMessage(0);
						};
					}
					var h = [];
					function u() {
						var e, t;
						n = !0;
						for (var r = h.length; r;) {
							for (t = h, h = [], e = -1; ++e < r;) t[e]();
							r = h.length;
						}
						n = !1;
					}
					l.exports = function(e) {
						1 !== h.push(e) || n || r();
					};
				}).call(this, "undefined" != typeof global ? global : "undefined" != typeof self ? self : "undefined" != typeof window ? window : {});
			}, {}],
			37: [function(e, t, r) {
				"use strict";
				var i = e("immediate");
				function u() {}
				var l = {}, s = ["REJECTED"], a = ["FULFILLED"], n = ["PENDING"];
				function o(e) {
					if ("function" != typeof e) throw new TypeError("resolver must be a function");
					this.state = n, this.queue = [], this.outcome = void 0, e !== u && d(this, e);
				}
				function h(e, t, r) {
					this.promise = e, "function" == typeof t && (this.onFulfilled = t, this.callFulfilled = this.otherCallFulfilled), "function" == typeof r && (this.onRejected = r, this.callRejected = this.otherCallRejected);
				}
				function f(t, r, n) {
					i(function() {
						var e;
						try {
							e = r(n);
						} catch (e) {
							return l.reject(t, e);
						}
						e === t ? l.reject(t, /* @__PURE__ */ new TypeError("Cannot resolve promise with itself")) : l.resolve(t, e);
					});
				}
				function c(e) {
					var t = e && e.then;
					if (e && ("object" == typeof e || "function" == typeof e) && "function" == typeof t) return function() {
						t.apply(e, arguments);
					};
				}
				function d(t, e) {
					var r = !1;
					function n(e) {
						r || (r = !0, l.reject(t, e));
					}
					function i(e) {
						r || (r = !0, l.resolve(t, e));
					}
					var s = p(function() {
						e(i, n);
					});
					"error" === s.status && n(s.value);
				}
				function p(e, t) {
					var r = {};
					try {
						r.value = e(t), r.status = "success";
					} catch (e) {
						r.status = "error", r.value = e;
					}
					return r;
				}
				(t.exports = o).prototype.finally = function(t) {
					if ("function" != typeof t) return this;
					var r = this.constructor;
					return this.then(function(e) {
						return r.resolve(t()).then(function() {
							return e;
						});
					}, function(e) {
						return r.resolve(t()).then(function() {
							throw e;
						});
					});
				}, o.prototype.catch = function(e) {
					return this.then(null, e);
				}, o.prototype.then = function(e, t) {
					if ("function" != typeof e && this.state === a || "function" != typeof t && this.state === s) return this;
					var r = new this.constructor(u);
					this.state !== n ? f(r, this.state === a ? e : t, this.outcome) : this.queue.push(new h(r, e, t));
					return r;
				}, h.prototype.callFulfilled = function(e) {
					l.resolve(this.promise, e);
				}, h.prototype.otherCallFulfilled = function(e) {
					f(this.promise, this.onFulfilled, e);
				}, h.prototype.callRejected = function(e) {
					l.reject(this.promise, e);
				}, h.prototype.otherCallRejected = function(e) {
					f(this.promise, this.onRejected, e);
				}, l.resolve = function(e, t) {
					var r = p(c, t);
					if ("error" === r.status) return l.reject(e, r.value);
					var n = r.value;
					if (n) d(e, n);
					else {
						e.state = a, e.outcome = t;
						for (var i = -1, s = e.queue.length; ++i < s;) e.queue[i].callFulfilled(t);
					}
					return e;
				}, l.reject = function(e, t) {
					e.state = s, e.outcome = t;
					for (var r = -1, n = e.queue.length; ++r < n;) e.queue[r].callRejected(t);
					return e;
				}, o.resolve = function(e) {
					if (e instanceof this) return e;
					return l.resolve(new this(u), e);
				}, o.reject = function(e) {
					var t = new this(u);
					return l.reject(t, e);
				}, o.all = function(e) {
					var r = this;
					if ("[object Array]" !== Object.prototype.toString.call(e)) return this.reject(/* @__PURE__ */ new TypeError("must be an array"));
					var n = e.length, i = !1;
					if (!n) return this.resolve([]);
					var s = new Array(n), a = 0, t = -1, o = new this(u);
					for (; ++t < n;) h(e[t], t);
					return o;
					function h(e, t) {
						r.resolve(e).then(function(e) {
							s[t] = e, ++a !== n || i || (i = !0, l.resolve(o, s));
						}, function(e) {
							i || (i = !0, l.reject(o, e));
						});
					}
				}, o.race = function(e) {
					var t = this;
					if ("[object Array]" !== Object.prototype.toString.call(e)) return this.reject(/* @__PURE__ */ new TypeError("must be an array"));
					var r = e.length, n = !1;
					if (!r) return this.resolve([]);
					var i = -1, s = new this(u);
					for (; ++i < r;) a = e[i], t.resolve(a).then(function(e) {
						n || (n = !0, l.resolve(s, e));
					}, function(e) {
						n || (n = !0, l.reject(s, e));
					});
					var a;
					return s;
				};
			}, { immediate: 36 }],
			38: [function(e, t, r) {
				"use strict";
				var n = {};
				(0, e("./lib/utils/common").assign)(n, e("./lib/deflate"), e("./lib/inflate"), e("./lib/zlib/constants")), t.exports = n;
			}, {
				"./lib/deflate": 39,
				"./lib/inflate": 40,
				"./lib/utils/common": 41,
				"./lib/zlib/constants": 44
			}],
			39: [function(e, t, r) {
				"use strict";
				var a = e("./zlib/deflate"), o = e("./utils/common"), h = e("./utils/strings"), i = e("./zlib/messages"), s = e("./zlib/zstream"), u = Object.prototype.toString, l = 0, f = -1, c = 0, d = 8;
				function p(e) {
					if (!(this instanceof p)) return new p(e);
					this.options = o.assign({
						level: f,
						method: d,
						chunkSize: 16384,
						windowBits: 15,
						memLevel: 8,
						strategy: c,
						to: ""
					}, e || {});
					var t = this.options;
					t.raw && 0 < t.windowBits ? t.windowBits = -t.windowBits : t.gzip && 0 < t.windowBits && t.windowBits < 16 && (t.windowBits += 16), this.err = 0, this.msg = "", this.ended = !1, this.chunks = [], this.strm = new s(), this.strm.avail_out = 0;
					var r = a.deflateInit2(this.strm, t.level, t.method, t.windowBits, t.memLevel, t.strategy);
					if (r !== l) throw new Error(i[r]);
					if (t.header && a.deflateSetHeader(this.strm, t.header), t.dictionary) {
						var n;
						if (n = "string" == typeof t.dictionary ? h.string2buf(t.dictionary) : "[object ArrayBuffer]" === u.call(t.dictionary) ? new Uint8Array(t.dictionary) : t.dictionary, (r = a.deflateSetDictionary(this.strm, n)) !== l) throw new Error(i[r]);
						this._dict_set = !0;
					}
				}
				function n(e, t) {
					var r = new p(t);
					if (r.push(e, !0), r.err) throw r.msg || i[r.err];
					return r.result;
				}
				p.prototype.push = function(e, t) {
					var r, n, i = this.strm, s = this.options.chunkSize;
					if (this.ended) return !1;
					n = t === ~~t ? t : !0 === t ? 4 : 0, "string" == typeof e ? i.input = h.string2buf(e) : "[object ArrayBuffer]" === u.call(e) ? i.input = new Uint8Array(e) : i.input = e, i.next_in = 0, i.avail_in = i.input.length;
					do {
						if (0 === i.avail_out && (i.output = new o.Buf8(s), i.next_out = 0, i.avail_out = s), 1 !== (r = a.deflate(i, n)) && r !== l) return this.onEnd(r), !(this.ended = !0);
						0 !== i.avail_out && (0 !== i.avail_in || 4 !== n && 2 !== n) || ("string" === this.options.to ? this.onData(h.buf2binstring(o.shrinkBuf(i.output, i.next_out))) : this.onData(o.shrinkBuf(i.output, i.next_out)));
					} while ((0 < i.avail_in || 0 === i.avail_out) && 1 !== r);
					return 4 === n ? (r = a.deflateEnd(this.strm), this.onEnd(r), this.ended = !0, r === l) : 2 !== n || (this.onEnd(l), !(i.avail_out = 0));
				}, p.prototype.onData = function(e) {
					this.chunks.push(e);
				}, p.prototype.onEnd = function(e) {
					e === l && ("string" === this.options.to ? this.result = this.chunks.join("") : this.result = o.flattenChunks(this.chunks)), this.chunks = [], this.err = e, this.msg = this.strm.msg;
				}, r.Deflate = p, r.deflate = n, r.deflateRaw = function(e, t) {
					return (t = t || {}).raw = !0, n(e, t);
				}, r.gzip = function(e, t) {
					return (t = t || {}).gzip = !0, n(e, t);
				};
			}, {
				"./utils/common": 41,
				"./utils/strings": 42,
				"./zlib/deflate": 46,
				"./zlib/messages": 51,
				"./zlib/zstream": 53
			}],
			40: [function(e, t, r) {
				"use strict";
				var c = e("./zlib/inflate"), d = e("./utils/common"), p = e("./utils/strings"), m = e("./zlib/constants"), n = e("./zlib/messages"), i = e("./zlib/zstream"), s = e("./zlib/gzheader"), _ = Object.prototype.toString;
				function a(e) {
					if (!(this instanceof a)) return new a(e);
					this.options = d.assign({
						chunkSize: 16384,
						windowBits: 0,
						to: ""
					}, e || {});
					var t = this.options;
					t.raw && 0 <= t.windowBits && t.windowBits < 16 && (t.windowBits = -t.windowBits, 0 === t.windowBits && (t.windowBits = -15)), !(0 <= t.windowBits && t.windowBits < 16) || e && e.windowBits || (t.windowBits += 32), 15 < t.windowBits && t.windowBits < 48 && 0 == (15 & t.windowBits) && (t.windowBits |= 15), this.err = 0, this.msg = "", this.ended = !1, this.chunks = [], this.strm = new i(), this.strm.avail_out = 0;
					var r = c.inflateInit2(this.strm, t.windowBits);
					if (r !== m.Z_OK) throw new Error(n[r]);
					this.header = new s(), c.inflateGetHeader(this.strm, this.header);
				}
				function o(e, t) {
					var r = new a(t);
					if (r.push(e, !0), r.err) throw r.msg || n[r.err];
					return r.result;
				}
				a.prototype.push = function(e, t) {
					var r, n, i, s, a, o, h = this.strm, u = this.options.chunkSize, l = this.options.dictionary, f = !1;
					if (this.ended) return !1;
					n = t === ~~t ? t : !0 === t ? m.Z_FINISH : m.Z_NO_FLUSH, "string" == typeof e ? h.input = p.binstring2buf(e) : "[object ArrayBuffer]" === _.call(e) ? h.input = new Uint8Array(e) : h.input = e, h.next_in = 0, h.avail_in = h.input.length;
					do {
						if (0 === h.avail_out && (h.output = new d.Buf8(u), h.next_out = 0, h.avail_out = u), (r = c.inflate(h, m.Z_NO_FLUSH)) === m.Z_NEED_DICT && l && (o = "string" == typeof l ? p.string2buf(l) : "[object ArrayBuffer]" === _.call(l) ? new Uint8Array(l) : l, r = c.inflateSetDictionary(this.strm, o)), r === m.Z_BUF_ERROR && !0 === f && (r = m.Z_OK, f = !1), r !== m.Z_STREAM_END && r !== m.Z_OK) return this.onEnd(r), !(this.ended = !0);
						h.next_out && (0 !== h.avail_out && r !== m.Z_STREAM_END && (0 !== h.avail_in || n !== m.Z_FINISH && n !== m.Z_SYNC_FLUSH) || ("string" === this.options.to ? (i = p.utf8border(h.output, h.next_out), s = h.next_out - i, a = p.buf2string(h.output, i), h.next_out = s, h.avail_out = u - s, s && d.arraySet(h.output, h.output, i, s, 0), this.onData(a)) : this.onData(d.shrinkBuf(h.output, h.next_out)))), 0 === h.avail_in && 0 === h.avail_out && (f = !0);
					} while ((0 < h.avail_in || 0 === h.avail_out) && r !== m.Z_STREAM_END);
					return r === m.Z_STREAM_END && (n = m.Z_FINISH), n === m.Z_FINISH ? (r = c.inflateEnd(this.strm), this.onEnd(r), this.ended = !0, r === m.Z_OK) : n !== m.Z_SYNC_FLUSH || (this.onEnd(m.Z_OK), !(h.avail_out = 0));
				}, a.prototype.onData = function(e) {
					this.chunks.push(e);
				}, a.prototype.onEnd = function(e) {
					e === m.Z_OK && ("string" === this.options.to ? this.result = this.chunks.join("") : this.result = d.flattenChunks(this.chunks)), this.chunks = [], this.err = e, this.msg = this.strm.msg;
				}, r.Inflate = a, r.inflate = o, r.inflateRaw = function(e, t) {
					return (t = t || {}).raw = !0, o(e, t);
				}, r.ungzip = o;
			}, {
				"./utils/common": 41,
				"./utils/strings": 42,
				"./zlib/constants": 44,
				"./zlib/gzheader": 47,
				"./zlib/inflate": 49,
				"./zlib/messages": 51,
				"./zlib/zstream": 53
			}],
			41: [function(e, t, r) {
				"use strict";
				var n = "undefined" != typeof Uint8Array && "undefined" != typeof Uint16Array && "undefined" != typeof Int32Array;
				r.assign = function(e) {
					for (var t = Array.prototype.slice.call(arguments, 1); t.length;) {
						var r = t.shift();
						if (r) {
							if ("object" != typeof r) throw new TypeError(r + "must be non-object");
							for (var n in r) r.hasOwnProperty(n) && (e[n] = r[n]);
						}
					}
					return e;
				}, r.shrinkBuf = function(e, t) {
					return e.length === t ? e : e.subarray ? e.subarray(0, t) : (e.length = t, e);
				};
				var i = {
					arraySet: function(e, t, r, n, i) {
						if (t.subarray && e.subarray) e.set(t.subarray(r, r + n), i);
						else for (var s = 0; s < n; s++) e[i + s] = t[r + s];
					},
					flattenChunks: function(e) {
						var t, r, n, i, s, a;
						for (t = n = 0, r = e.length; t < r; t++) n += e[t].length;
						for (a = new Uint8Array(n), t = i = 0, r = e.length; t < r; t++) s = e[t], a.set(s, i), i += s.length;
						return a;
					}
				}, s = {
					arraySet: function(e, t, r, n, i) {
						for (var s = 0; s < n; s++) e[i + s] = t[r + s];
					},
					flattenChunks: function(e) {
						return [].concat.apply([], e);
					}
				};
				r.setTyped = function(e) {
					e ? (r.Buf8 = Uint8Array, r.Buf16 = Uint16Array, r.Buf32 = Int32Array, r.assign(r, i)) : (r.Buf8 = Array, r.Buf16 = Array, r.Buf32 = Array, r.assign(r, s));
				}, r.setTyped(n);
			}, {}],
			42: [function(e, t, r) {
				"use strict";
				var h = e("./common"), i = !0, s = !0;
				try {
					String.fromCharCode.apply(null, [0]);
				} catch (e) {
					i = !1;
				}
				try {
					String.fromCharCode.apply(null, /* @__PURE__ */ new Uint8Array(1));
				} catch (e) {
					s = !1;
				}
				for (var u = new h.Buf8(256), n = 0; n < 256; n++) u[n] = 252 <= n ? 6 : 248 <= n ? 5 : 240 <= n ? 4 : 224 <= n ? 3 : 192 <= n ? 2 : 1;
				function l(e, t) {
					if (t < 65537 && (e.subarray && s || !e.subarray && i)) return String.fromCharCode.apply(null, h.shrinkBuf(e, t));
					for (var r = "", n = 0; n < t; n++) r += String.fromCharCode(e[n]);
					return r;
				}
				u[254] = u[254] = 1, r.string2buf = function(e) {
					var t, r, n, i, s, a = e.length, o = 0;
					for (i = 0; i < a; i++) 55296 == (64512 & (r = e.charCodeAt(i))) && i + 1 < a && 56320 == (64512 & (n = e.charCodeAt(i + 1))) && (r = 65536 + (r - 55296 << 10) + (n - 56320), i++), o += r < 128 ? 1 : r < 2048 ? 2 : r < 65536 ? 3 : 4;
					for (t = new h.Buf8(o), i = s = 0; s < o; i++) 55296 == (64512 & (r = e.charCodeAt(i))) && i + 1 < a && 56320 == (64512 & (n = e.charCodeAt(i + 1))) && (r = 65536 + (r - 55296 << 10) + (n - 56320), i++), r < 128 ? t[s++] = r : (r < 2048 ? t[s++] = 192 | r >>> 6 : (r < 65536 ? t[s++] = 224 | r >>> 12 : (t[s++] = 240 | r >>> 18, t[s++] = 128 | r >>> 12 & 63), t[s++] = 128 | r >>> 6 & 63), t[s++] = 128 | 63 & r);
					return t;
				}, r.buf2binstring = function(e) {
					return l(e, e.length);
				}, r.binstring2buf = function(e) {
					for (var t = new h.Buf8(e.length), r = 0, n = t.length; r < n; r++) t[r] = e.charCodeAt(r);
					return t;
				}, r.buf2string = function(e, t) {
					var r, n, i, s, a = t || e.length, o = new Array(2 * a);
					for (r = n = 0; r < a;) if ((i = e[r++]) < 128) o[n++] = i;
					else if (4 < (s = u[i])) o[n++] = 65533, r += s - 1;
					else {
						for (i &= 2 === s ? 31 : 3 === s ? 15 : 7; 1 < s && r < a;) i = i << 6 | 63 & e[r++], s--;
						1 < s ? o[n++] = 65533 : i < 65536 ? o[n++] = i : (i -= 65536, o[n++] = 55296 | i >> 10 & 1023, o[n++] = 56320 | 1023 & i);
					}
					return l(o, n);
				}, r.utf8border = function(e, t) {
					var r;
					for ((t = t || e.length) > e.length && (t = e.length), r = t - 1; 0 <= r && 128 == (192 & e[r]);) r--;
					return r < 0 ? t : 0 === r ? t : r + u[e[r]] > t ? r : t;
				};
			}, { "./common": 41 }],
			43: [function(e, t, r) {
				"use strict";
				t.exports = function(e, t, r, n) {
					for (var i = 65535 & e | 0, s = e >>> 16 & 65535 | 0, a = 0; 0 !== r;) {
						for (r -= a = 2e3 < r ? 2e3 : r; s = s + (i = i + t[n++] | 0) | 0, --a;);
						i %= 65521, s %= 65521;
					}
					return i | s << 16 | 0;
				};
			}, {}],
			44: [function(e, t, r) {
				"use strict";
				t.exports = {
					Z_NO_FLUSH: 0,
					Z_PARTIAL_FLUSH: 1,
					Z_SYNC_FLUSH: 2,
					Z_FULL_FLUSH: 3,
					Z_FINISH: 4,
					Z_BLOCK: 5,
					Z_TREES: 6,
					Z_OK: 0,
					Z_STREAM_END: 1,
					Z_NEED_DICT: 2,
					Z_ERRNO: -1,
					Z_STREAM_ERROR: -2,
					Z_DATA_ERROR: -3,
					Z_BUF_ERROR: -5,
					Z_NO_COMPRESSION: 0,
					Z_BEST_SPEED: 1,
					Z_BEST_COMPRESSION: 9,
					Z_DEFAULT_COMPRESSION: -1,
					Z_FILTERED: 1,
					Z_HUFFMAN_ONLY: 2,
					Z_RLE: 3,
					Z_FIXED: 4,
					Z_DEFAULT_STRATEGY: 0,
					Z_BINARY: 0,
					Z_TEXT: 1,
					Z_UNKNOWN: 2,
					Z_DEFLATED: 8
				};
			}, {}],
			45: [function(e, t, r) {
				"use strict";
				var o = function() {
					for (var e, t = [], r = 0; r < 256; r++) {
						e = r;
						for (var n = 0; n < 8; n++) e = 1 & e ? 3988292384 ^ e >>> 1 : e >>> 1;
						t[r] = e;
					}
					return t;
				}();
				t.exports = function(e, t, r, n) {
					var i = o, s = n + r;
					e ^= -1;
					for (var a = n; a < s; a++) e = e >>> 8 ^ i[255 & (e ^ t[a])];
					return -1 ^ e;
				};
			}, {}],
			46: [function(e, t, r) {
				"use strict";
				var h, c = e("../utils/common"), u = e("./trees"), d = e("./adler32"), p = e("./crc32"), n = e("./messages"), l = 0, f = 4, m = 0, _ = -2, g = -1, b = 4, i = 2, v = 8, y = 9, s = 286, a = 30, o = 19, w = 2 * s + 1, k = 15, x = 3, S = 258, z = S + x + 1, C = 42, E = 113, A = 1, I = 2, O = 3, B = 4;
				function R(e, t) {
					return e.msg = n[t], t;
				}
				function T(e) {
					return (e << 1) - (4 < e ? 9 : 0);
				}
				function D(e) {
					for (var t = e.length; 0 <= --t;) e[t] = 0;
				}
				function F(e) {
					var t = e.state, r = t.pending;
					r > e.avail_out && (r = e.avail_out), 0 !== r && (c.arraySet(e.output, t.pending_buf, t.pending_out, r, e.next_out), e.next_out += r, t.pending_out += r, e.total_out += r, e.avail_out -= r, t.pending -= r, 0 === t.pending && (t.pending_out = 0));
				}
				function N(e, t) {
					u._tr_flush_block(e, 0 <= e.block_start ? e.block_start : -1, e.strstart - e.block_start, t), e.block_start = e.strstart, F(e.strm);
				}
				function U(e, t) {
					e.pending_buf[e.pending++] = t;
				}
				function P(e, t) {
					e.pending_buf[e.pending++] = t >>> 8 & 255, e.pending_buf[e.pending++] = 255 & t;
				}
				function L(e, t) {
					var r, n, i = e.max_chain_length, s = e.strstart, a = e.prev_length, o = e.nice_match, h = e.strstart > e.w_size - z ? e.strstart - (e.w_size - z) : 0, u = e.window, l = e.w_mask, f = e.prev, c = e.strstart + S, d = u[s + a - 1], p = u[s + a];
					e.prev_length >= e.good_match && (i >>= 2), o > e.lookahead && (o = e.lookahead);
					do
						if (u[(r = t) + a] === p && u[r + a - 1] === d && u[r] === u[s] && u[++r] === u[s + 1]) {
							s += 2, r++;
							do							;
while (u[++s] === u[++r] && u[++s] === u[++r] && u[++s] === u[++r] && u[++s] === u[++r] && u[++s] === u[++r] && u[++s] === u[++r] && u[++s] === u[++r] && u[++s] === u[++r] && s < c);
							if (n = S - (c - s), s = c - S, a < n) {
								if (e.match_start = t, o <= (a = n)) break;
								d = u[s + a - 1], p = u[s + a];
							}
						}
					while ((t = f[t & l]) > h && 0 != --i);
					return a <= e.lookahead ? a : e.lookahead;
				}
				function j(e) {
					var t, r, n, i, s, a, o, h, u, l, f = e.w_size;
					do {
						if (i = e.window_size - e.lookahead - e.strstart, e.strstart >= f + (f - z)) {
							for (c.arraySet(e.window, e.window, f, f, 0), e.match_start -= f, e.strstart -= f, e.block_start -= f, t = r = e.hash_size; n = e.head[--t], e.head[t] = f <= n ? n - f : 0, --r;);
							for (t = r = f; n = e.prev[--t], e.prev[t] = f <= n ? n - f : 0, --r;);
							i += f;
						}
						if (0 === e.strm.avail_in) break;
						if (a = e.strm, o = e.window, h = e.strstart + e.lookahead, u = i, l = void 0, l = a.avail_in, u < l && (l = u), r = 0 === l ? 0 : (a.avail_in -= l, c.arraySet(o, a.input, a.next_in, l, h), 1 === a.state.wrap ? a.adler = d(a.adler, o, l, h) : 2 === a.state.wrap && (a.adler = p(a.adler, o, l, h)), a.next_in += l, a.total_in += l, l), e.lookahead += r, e.lookahead + e.insert >= x) for (s = e.strstart - e.insert, e.ins_h = e.window[s], e.ins_h = (e.ins_h << e.hash_shift ^ e.window[s + 1]) & e.hash_mask; e.insert && (e.ins_h = (e.ins_h << e.hash_shift ^ e.window[s + x - 1]) & e.hash_mask, e.prev[s & e.w_mask] = e.head[e.ins_h], e.head[e.ins_h] = s, s++, e.insert--, !(e.lookahead + e.insert < x)););
					} while (e.lookahead < z && 0 !== e.strm.avail_in);
				}
				function Z(e, t) {
					for (var r, n;;) {
						if (e.lookahead < z) {
							if (j(e), e.lookahead < z && t === l) return A;
							if (0 === e.lookahead) break;
						}
						if (r = 0, e.lookahead >= x && (e.ins_h = (e.ins_h << e.hash_shift ^ e.window[e.strstart + x - 1]) & e.hash_mask, r = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h], e.head[e.ins_h] = e.strstart), 0 !== r && e.strstart - r <= e.w_size - z && (e.match_length = L(e, r)), e.match_length >= x) if (n = u._tr_tally(e, e.strstart - e.match_start, e.match_length - x), e.lookahead -= e.match_length, e.match_length <= e.max_lazy_match && e.lookahead >= x) {
							for (e.match_length--; e.strstart++, e.ins_h = (e.ins_h << e.hash_shift ^ e.window[e.strstart + x - 1]) & e.hash_mask, r = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h], e.head[e.ins_h] = e.strstart, 0 != --e.match_length;);
							e.strstart++;
						} else e.strstart += e.match_length, e.match_length = 0, e.ins_h = e.window[e.strstart], e.ins_h = (e.ins_h << e.hash_shift ^ e.window[e.strstart + 1]) & e.hash_mask;
						else n = u._tr_tally(e, 0, e.window[e.strstart]), e.lookahead--, e.strstart++;
						if (n && (N(e, !1), 0 === e.strm.avail_out)) return A;
					}
					return e.insert = e.strstart < x - 1 ? e.strstart : x - 1, t === f ? (N(e, !0), 0 === e.strm.avail_out ? O : B) : e.last_lit && (N(e, !1), 0 === e.strm.avail_out) ? A : I;
				}
				function W(e, t) {
					for (var r, n, i;;) {
						if (e.lookahead < z) {
							if (j(e), e.lookahead < z && t === l) return A;
							if (0 === e.lookahead) break;
						}
						if (r = 0, e.lookahead >= x && (e.ins_h = (e.ins_h << e.hash_shift ^ e.window[e.strstart + x - 1]) & e.hash_mask, r = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h], e.head[e.ins_h] = e.strstart), e.prev_length = e.match_length, e.prev_match = e.match_start, e.match_length = x - 1, 0 !== r && e.prev_length < e.max_lazy_match && e.strstart - r <= e.w_size - z && (e.match_length = L(e, r), e.match_length <= 5 && (1 === e.strategy || e.match_length === x && 4096 < e.strstart - e.match_start) && (e.match_length = x - 1)), e.prev_length >= x && e.match_length <= e.prev_length) {
							for (i = e.strstart + e.lookahead - x, n = u._tr_tally(e, e.strstart - 1 - e.prev_match, e.prev_length - x), e.lookahead -= e.prev_length - 1, e.prev_length -= 2; ++e.strstart <= i && (e.ins_h = (e.ins_h << e.hash_shift ^ e.window[e.strstart + x - 1]) & e.hash_mask, r = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h], e.head[e.ins_h] = e.strstart), 0 != --e.prev_length;);
							if (e.match_available = 0, e.match_length = x - 1, e.strstart++, n && (N(e, !1), 0 === e.strm.avail_out)) return A;
						} else if (e.match_available) {
							if ((n = u._tr_tally(e, 0, e.window[e.strstart - 1])) && N(e, !1), e.strstart++, e.lookahead--, 0 === e.strm.avail_out) return A;
						} else e.match_available = 1, e.strstart++, e.lookahead--;
					}
					return e.match_available && (n = u._tr_tally(e, 0, e.window[e.strstart - 1]), e.match_available = 0), e.insert = e.strstart < x - 1 ? e.strstart : x - 1, t === f ? (N(e, !0), 0 === e.strm.avail_out ? O : B) : e.last_lit && (N(e, !1), 0 === e.strm.avail_out) ? A : I;
				}
				function M(e, t, r, n, i) {
					this.good_length = e, this.max_lazy = t, this.nice_length = r, this.max_chain = n, this.func = i;
				}
				function H() {
					this.strm = null, this.status = 0, this.pending_buf = null, this.pending_buf_size = 0, this.pending_out = 0, this.pending = 0, this.wrap = 0, this.gzhead = null, this.gzindex = 0, this.method = v, this.last_flush = -1, this.w_size = 0, this.w_bits = 0, this.w_mask = 0, this.window = null, this.window_size = 0, this.prev = null, this.head = null, this.ins_h = 0, this.hash_size = 0, this.hash_bits = 0, this.hash_mask = 0, this.hash_shift = 0, this.block_start = 0, this.match_length = 0, this.prev_match = 0, this.match_available = 0, this.strstart = 0, this.match_start = 0, this.lookahead = 0, this.prev_length = 0, this.max_chain_length = 0, this.max_lazy_match = 0, this.level = 0, this.strategy = 0, this.good_match = 0, this.nice_match = 0, this.dyn_ltree = new c.Buf16(2 * w), this.dyn_dtree = new c.Buf16(2 * (2 * a + 1)), this.bl_tree = new c.Buf16(2 * (2 * o + 1)), D(this.dyn_ltree), D(this.dyn_dtree), D(this.bl_tree), this.l_desc = null, this.d_desc = null, this.bl_desc = null, this.bl_count = new c.Buf16(k + 1), this.heap = new c.Buf16(2 * s + 1), D(this.heap), this.heap_len = 0, this.heap_max = 0, this.depth = new c.Buf16(2 * s + 1), D(this.depth), this.l_buf = 0, this.lit_bufsize = 0, this.last_lit = 0, this.d_buf = 0, this.opt_len = 0, this.static_len = 0, this.matches = 0, this.insert = 0, this.bi_buf = 0, this.bi_valid = 0;
				}
				function G(e) {
					var t;
					return e && e.state ? (e.total_in = e.total_out = 0, e.data_type = i, (t = e.state).pending = 0, t.pending_out = 0, t.wrap < 0 && (t.wrap = -t.wrap), t.status = t.wrap ? C : E, e.adler = 2 === t.wrap ? 0 : 1, t.last_flush = l, u._tr_init(t), m) : R(e, _);
				}
				function K(e) {
					var t = G(e);
					return t === m && function(e) {
						e.window_size = 2 * e.w_size, D(e.head), e.max_lazy_match = h[e.level].max_lazy, e.good_match = h[e.level].good_length, e.nice_match = h[e.level].nice_length, e.max_chain_length = h[e.level].max_chain, e.strstart = 0, e.block_start = 0, e.lookahead = 0, e.insert = 0, e.match_length = e.prev_length = x - 1, e.match_available = 0, e.ins_h = 0;
					}(e.state), t;
				}
				function Y(e, t, r, n, i, s) {
					if (!e) return _;
					var a = 1;
					if (t === g && (t = 6), n < 0 ? (a = 0, n = -n) : 15 < n && (a = 2, n -= 16), i < 1 || y < i || r !== v || n < 8 || 15 < n || t < 0 || 9 < t || s < 0 || b < s) return R(e, _);
					8 === n && (n = 9);
					var o = new H();
					return (e.state = o).strm = e, o.wrap = a, o.gzhead = null, o.w_bits = n, o.w_size = 1 << o.w_bits, o.w_mask = o.w_size - 1, o.hash_bits = i + 7, o.hash_size = 1 << o.hash_bits, o.hash_mask = o.hash_size - 1, o.hash_shift = ~~((o.hash_bits + x - 1) / x), o.window = new c.Buf8(2 * o.w_size), o.head = new c.Buf16(o.hash_size), o.prev = new c.Buf16(o.w_size), o.lit_bufsize = 1 << i + 6, o.pending_buf_size = 4 * o.lit_bufsize, o.pending_buf = new c.Buf8(o.pending_buf_size), o.d_buf = 1 * o.lit_bufsize, o.l_buf = 3 * o.lit_bufsize, o.level = t, o.strategy = s, o.method = r, K(e);
				}
				h = [
					new M(0, 0, 0, 0, function(e, t) {
						var r = 65535;
						for (r > e.pending_buf_size - 5 && (r = e.pending_buf_size - 5);;) {
							if (e.lookahead <= 1) {
								if (j(e), 0 === e.lookahead && t === l) return A;
								if (0 === e.lookahead) break;
							}
							e.strstart += e.lookahead, e.lookahead = 0;
							var n = e.block_start + r;
							if ((0 === e.strstart || e.strstart >= n) && (e.lookahead = e.strstart - n, e.strstart = n, N(e, !1), 0 === e.strm.avail_out)) return A;
							if (e.strstart - e.block_start >= e.w_size - z && (N(e, !1), 0 === e.strm.avail_out)) return A;
						}
						return e.insert = 0, t === f ? (N(e, !0), 0 === e.strm.avail_out ? O : B) : (e.strstart > e.block_start && (N(e, !1), e.strm.avail_out), A);
					}),
					new M(4, 4, 8, 4, Z),
					new M(4, 5, 16, 8, Z),
					new M(4, 6, 32, 32, Z),
					new M(4, 4, 16, 16, W),
					new M(8, 16, 32, 32, W),
					new M(8, 16, 128, 128, W),
					new M(8, 32, 128, 256, W),
					new M(32, 128, 258, 1024, W),
					new M(32, 258, 258, 4096, W)
				], r.deflateInit = function(e, t) {
					return Y(e, t, v, 15, 8, 0);
				}, r.deflateInit2 = Y, r.deflateReset = K, r.deflateResetKeep = G, r.deflateSetHeader = function(e, t) {
					return e && e.state ? 2 !== e.state.wrap ? _ : (e.state.gzhead = t, m) : _;
				}, r.deflate = function(e, t) {
					var r, n, i, s;
					if (!e || !e.state || 5 < t || t < 0) return e ? R(e, _) : _;
					if (n = e.state, !e.output || !e.input && 0 !== e.avail_in || 666 === n.status && t !== f) return R(e, 0 === e.avail_out ? -5 : _);
					if (n.strm = e, r = n.last_flush, n.last_flush = t, n.status === C) if (2 === n.wrap) e.adler = 0, U(n, 31), U(n, 139), U(n, 8), n.gzhead ? (U(n, (n.gzhead.text ? 1 : 0) + (n.gzhead.hcrc ? 2 : 0) + (n.gzhead.extra ? 4 : 0) + (n.gzhead.name ? 8 : 0) + (n.gzhead.comment ? 16 : 0)), U(n, 255 & n.gzhead.time), U(n, n.gzhead.time >> 8 & 255), U(n, n.gzhead.time >> 16 & 255), U(n, n.gzhead.time >> 24 & 255), U(n, 9 === n.level ? 2 : 2 <= n.strategy || n.level < 2 ? 4 : 0), U(n, 255 & n.gzhead.os), n.gzhead.extra && n.gzhead.extra.length && (U(n, 255 & n.gzhead.extra.length), U(n, n.gzhead.extra.length >> 8 & 255)), n.gzhead.hcrc && (e.adler = p(e.adler, n.pending_buf, n.pending, 0)), n.gzindex = 0, n.status = 69) : (U(n, 0), U(n, 0), U(n, 0), U(n, 0), U(n, 0), U(n, 9 === n.level ? 2 : 2 <= n.strategy || n.level < 2 ? 4 : 0), U(n, 3), n.status = E);
					else {
						var a = v + (n.w_bits - 8 << 4) << 8;
						a |= (2 <= n.strategy || n.level < 2 ? 0 : n.level < 6 ? 1 : 6 === n.level ? 2 : 3) << 6, 0 !== n.strstart && (a |= 32), a += 31 - a % 31, n.status = E, P(n, a), 0 !== n.strstart && (P(n, e.adler >>> 16), P(n, 65535 & e.adler)), e.adler = 1;
					}
					if (69 === n.status) if (n.gzhead.extra) {
						for (i = n.pending; n.gzindex < (65535 & n.gzhead.extra.length) && (n.pending !== n.pending_buf_size || (n.gzhead.hcrc && n.pending > i && (e.adler = p(e.adler, n.pending_buf, n.pending - i, i)), F(e), i = n.pending, n.pending !== n.pending_buf_size));) U(n, 255 & n.gzhead.extra[n.gzindex]), n.gzindex++;
						n.gzhead.hcrc && n.pending > i && (e.adler = p(e.adler, n.pending_buf, n.pending - i, i)), n.gzindex === n.gzhead.extra.length && (n.gzindex = 0, n.status = 73);
					} else n.status = 73;
					if (73 === n.status) if (n.gzhead.name) {
						i = n.pending;
						do {
							if (n.pending === n.pending_buf_size && (n.gzhead.hcrc && n.pending > i && (e.adler = p(e.adler, n.pending_buf, n.pending - i, i)), F(e), i = n.pending, n.pending === n.pending_buf_size)) {
								s = 1;
								break;
							}
							s = n.gzindex < n.gzhead.name.length ? 255 & n.gzhead.name.charCodeAt(n.gzindex++) : 0, U(n, s);
						} while (0 !== s);
						n.gzhead.hcrc && n.pending > i && (e.adler = p(e.adler, n.pending_buf, n.pending - i, i)), 0 === s && (n.gzindex = 0, n.status = 91);
					} else n.status = 91;
					if (91 === n.status) if (n.gzhead.comment) {
						i = n.pending;
						do {
							if (n.pending === n.pending_buf_size && (n.gzhead.hcrc && n.pending > i && (e.adler = p(e.adler, n.pending_buf, n.pending - i, i)), F(e), i = n.pending, n.pending === n.pending_buf_size)) {
								s = 1;
								break;
							}
							s = n.gzindex < n.gzhead.comment.length ? 255 & n.gzhead.comment.charCodeAt(n.gzindex++) : 0, U(n, s);
						} while (0 !== s);
						n.gzhead.hcrc && n.pending > i && (e.adler = p(e.adler, n.pending_buf, n.pending - i, i)), 0 === s && (n.status = 103);
					} else n.status = 103;
					if (103 === n.status && (n.gzhead.hcrc ? (n.pending + 2 > n.pending_buf_size && F(e), n.pending + 2 <= n.pending_buf_size && (U(n, 255 & e.adler), U(n, e.adler >> 8 & 255), e.adler = 0, n.status = E)) : n.status = E), 0 !== n.pending) {
						if (F(e), 0 === e.avail_out) return n.last_flush = -1, m;
					} else if (0 === e.avail_in && T(t) <= T(r) && t !== f) return R(e, -5);
					if (666 === n.status && 0 !== e.avail_in) return R(e, -5);
					if (0 !== e.avail_in || 0 !== n.lookahead || t !== l && 666 !== n.status) {
						var o = 2 === n.strategy ? function(e, t) {
							for (var r;;) {
								if (0 === e.lookahead && (j(e), 0 === e.lookahead)) {
									if (t === l) return A;
									break;
								}
								if (e.match_length = 0, r = u._tr_tally(e, 0, e.window[e.strstart]), e.lookahead--, e.strstart++, r && (N(e, !1), 0 === e.strm.avail_out)) return A;
							}
							return e.insert = 0, t === f ? (N(e, !0), 0 === e.strm.avail_out ? O : B) : e.last_lit && (N(e, !1), 0 === e.strm.avail_out) ? A : I;
						}(n, t) : 3 === n.strategy ? function(e, t) {
							for (var r, n, i, s, a = e.window;;) {
								if (e.lookahead <= S) {
									if (j(e), e.lookahead <= S && t === l) return A;
									if (0 === e.lookahead) break;
								}
								if (e.match_length = 0, e.lookahead >= x && 0 < e.strstart && (n = a[i = e.strstart - 1]) === a[++i] && n === a[++i] && n === a[++i]) {
									s = e.strstart + S;
									do									;
while (n === a[++i] && n === a[++i] && n === a[++i] && n === a[++i] && n === a[++i] && n === a[++i] && n === a[++i] && n === a[++i] && i < s);
									e.match_length = S - (s - i), e.match_length > e.lookahead && (e.match_length = e.lookahead);
								}
								if (e.match_length >= x ? (r = u._tr_tally(e, 1, e.match_length - x), e.lookahead -= e.match_length, e.strstart += e.match_length, e.match_length = 0) : (r = u._tr_tally(e, 0, e.window[e.strstart]), e.lookahead--, e.strstart++), r && (N(e, !1), 0 === e.strm.avail_out)) return A;
							}
							return e.insert = 0, t === f ? (N(e, !0), 0 === e.strm.avail_out ? O : B) : e.last_lit && (N(e, !1), 0 === e.strm.avail_out) ? A : I;
						}(n, t) : h[n.level].func(n, t);
						if (o !== O && o !== B || (n.status = 666), o === A || o === O) return 0 === e.avail_out && (n.last_flush = -1), m;
						if (o === I && (1 === t ? u._tr_align(n) : 5 !== t && (u._tr_stored_block(n, 0, 0, !1), 3 === t && (D(n.head), 0 === n.lookahead && (n.strstart = 0, n.block_start = 0, n.insert = 0))), F(e), 0 === e.avail_out)) return n.last_flush = -1, m;
					}
					return t !== f ? m : n.wrap <= 0 ? 1 : (2 === n.wrap ? (U(n, 255 & e.adler), U(n, e.adler >> 8 & 255), U(n, e.adler >> 16 & 255), U(n, e.adler >> 24 & 255), U(n, 255 & e.total_in), U(n, e.total_in >> 8 & 255), U(n, e.total_in >> 16 & 255), U(n, e.total_in >> 24 & 255)) : (P(n, e.adler >>> 16), P(n, 65535 & e.adler)), F(e), 0 < n.wrap && (n.wrap = -n.wrap), 0 !== n.pending ? m : 1);
				}, r.deflateEnd = function(e) {
					var t;
					return e && e.state ? (t = e.state.status) !== C && 69 !== t && 73 !== t && 91 !== t && 103 !== t && t !== E && 666 !== t ? R(e, _) : (e.state = null, t === E ? R(e, -3) : m) : _;
				}, r.deflateSetDictionary = function(e, t) {
					var r, n, i, s, a, o, h, u, l = t.length;
					if (!e || !e.state) return _;
					if (2 === (s = (r = e.state).wrap) || 1 === s && r.status !== C || r.lookahead) return _;
					for (1 === s && (e.adler = d(e.adler, t, l, 0)), r.wrap = 0, l >= r.w_size && (0 === s && (D(r.head), r.strstart = 0, r.block_start = 0, r.insert = 0), u = new c.Buf8(r.w_size), c.arraySet(u, t, l - r.w_size, r.w_size, 0), t = u, l = r.w_size), a = e.avail_in, o = e.next_in, h = e.input, e.avail_in = l, e.next_in = 0, e.input = t, j(r); r.lookahead >= x;) {
						for (n = r.strstart, i = r.lookahead - (x - 1); r.ins_h = (r.ins_h << r.hash_shift ^ r.window[n + x - 1]) & r.hash_mask, r.prev[n & r.w_mask] = r.head[r.ins_h], r.head[r.ins_h] = n, n++, --i;);
						r.strstart = n, r.lookahead = x - 1, j(r);
					}
					return r.strstart += r.lookahead, r.block_start = r.strstart, r.insert = r.lookahead, r.lookahead = 0, r.match_length = r.prev_length = x - 1, r.match_available = 0, e.next_in = o, e.input = h, e.avail_in = a, r.wrap = s, m;
				}, r.deflateInfo = "pako deflate (from Nodeca project)";
			}, {
				"../utils/common": 41,
				"./adler32": 43,
				"./crc32": 45,
				"./messages": 51,
				"./trees": 52
			}],
			47: [function(e, t, r) {
				"use strict";
				t.exports = function() {
					this.text = 0, this.time = 0, this.xflags = 0, this.os = 0, this.extra = null, this.extra_len = 0, this.name = "", this.comment = "", this.hcrc = 0, this.done = !1;
				};
			}, {}],
			48: [function(e, t, r) {
				"use strict";
				t.exports = function(e, t) {
					var r = e.state, n = e.next_in, i, s, a, o, h, u, l, f, c, d, p, m, _, g, b, v, y, w, k, x, S, z = e.input, C;
					i = n + (e.avail_in - 5), s = e.next_out, C = e.output, a = s - (t - e.avail_out), o = s + (e.avail_out - 257), h = r.dmax, u = r.wsize, l = r.whave, f = r.wnext, c = r.window, d = r.hold, p = r.bits, m = r.lencode, _ = r.distcode, g = (1 << r.lenbits) - 1, b = (1 << r.distbits) - 1;
					e: do {
						p < 15 && (d += z[n++] << p, p += 8, d += z[n++] << p, p += 8), v = m[d & g];
						t: for (;;) {
							if (d >>>= y = v >>> 24, p -= y, 0 === (y = v >>> 16 & 255)) C[s++] = 65535 & v;
							else {
								if (!(16 & y)) {
									if (0 == (64 & y)) {
										v = m[(65535 & v) + (d & (1 << y) - 1)];
										continue t;
									}
									if (32 & y) {
										r.mode = 12;
										break e;
									}
									e.msg = "invalid literal/length code", r.mode = 30;
									break e;
								}
								w = 65535 & v, (y &= 15) && (p < y && (d += z[n++] << p, p += 8), w += d & (1 << y) - 1, d >>>= y, p -= y), p < 15 && (d += z[n++] << p, p += 8, d += z[n++] << p, p += 8), v = _[d & b];
								r: for (;;) {
									if (d >>>= y = v >>> 24, p -= y, !(16 & (y = v >>> 16 & 255))) {
										if (0 == (64 & y)) {
											v = _[(65535 & v) + (d & (1 << y) - 1)];
											continue r;
										}
										e.msg = "invalid distance code", r.mode = 30;
										break e;
									}
									if (k = 65535 & v, p < (y &= 15) && (d += z[n++] << p, (p += 8) < y && (d += z[n++] << p, p += 8)), h < (k += d & (1 << y) - 1)) {
										e.msg = "invalid distance too far back", r.mode = 30;
										break e;
									}
									if (d >>>= y, p -= y, (y = s - a) < k) {
										if (l < (y = k - y) && r.sane) {
											e.msg = "invalid distance too far back", r.mode = 30;
											break e;
										}
										if (S = c, (x = 0) === f) {
											if (x += u - y, y < w) {
												for (w -= y; C[s++] = c[x++], --y;);
												x = s - k, S = C;
											}
										} else if (f < y) {
											if (x += u + f - y, (y -= f) < w) {
												for (w -= y; C[s++] = c[x++], --y;);
												if (x = 0, f < w) {
													for (w -= y = f; C[s++] = c[x++], --y;);
													x = s - k, S = C;
												}
											}
										} else if (x += f - y, y < w) {
											for (w -= y; C[s++] = c[x++], --y;);
											x = s - k, S = C;
										}
										for (; 2 < w;) C[s++] = S[x++], C[s++] = S[x++], C[s++] = S[x++], w -= 3;
										w && (C[s++] = S[x++], 1 < w && (C[s++] = S[x++]));
									} else {
										for (x = s - k; C[s++] = C[x++], C[s++] = C[x++], C[s++] = C[x++], 2 < (w -= 3););
										w && (C[s++] = C[x++], 1 < w && (C[s++] = C[x++]));
									}
									break;
								}
							}
							break;
						}
					} while (n < i && s < o);
					n -= w = p >> 3, d &= (1 << (p -= w << 3)) - 1, e.next_in = n, e.next_out = s, e.avail_in = n < i ? i - n + 5 : 5 - (n - i), e.avail_out = s < o ? o - s + 257 : 257 - (s - o), r.hold = d, r.bits = p;
				};
			}, {}],
			49: [function(e, t, r) {
				"use strict";
				var I = e("../utils/common"), O = e("./adler32"), B = e("./crc32"), R = e("./inffast"), T = e("./inftrees"), D = 1, F = 2, N = 0, U = -2, P = 1, n = 852, i = 592;
				function L(e) {
					return (e >>> 24 & 255) + (e >>> 8 & 65280) + ((65280 & e) << 8) + ((255 & e) << 24);
				}
				function s() {
					this.mode = 0, this.last = !1, this.wrap = 0, this.havedict = !1, this.flags = 0, this.dmax = 0, this.check = 0, this.total = 0, this.head = null, this.wbits = 0, this.wsize = 0, this.whave = 0, this.wnext = 0, this.window = null, this.hold = 0, this.bits = 0, this.length = 0, this.offset = 0, this.extra = 0, this.lencode = null, this.distcode = null, this.lenbits = 0, this.distbits = 0, this.ncode = 0, this.nlen = 0, this.ndist = 0, this.have = 0, this.next = null, this.lens = new I.Buf16(320), this.work = new I.Buf16(288), this.lendyn = null, this.distdyn = null, this.sane = 0, this.back = 0, this.was = 0;
				}
				function a(e) {
					var t;
					return e && e.state ? (t = e.state, e.total_in = e.total_out = t.total = 0, e.msg = "", t.wrap && (e.adler = 1 & t.wrap), t.mode = P, t.last = 0, t.havedict = 0, t.dmax = 32768, t.head = null, t.hold = 0, t.bits = 0, t.lencode = t.lendyn = new I.Buf32(n), t.distcode = t.distdyn = new I.Buf32(i), t.sane = 1, t.back = -1, N) : U;
				}
				function o(e) {
					var t;
					return e && e.state ? ((t = e.state).wsize = 0, t.whave = 0, t.wnext = 0, a(e)) : U;
				}
				function h(e, t) {
					var r, n;
					return e && e.state ? (n = e.state, t < 0 ? (r = 0, t = -t) : (r = 1 + (t >> 4), t < 48 && (t &= 15)), t && (t < 8 || 15 < t) ? U : (null !== n.window && n.wbits !== t && (n.window = null), n.wrap = r, n.wbits = t, o(e))) : U;
				}
				function u(e, t) {
					var r, n;
					return e ? (n = new s(), (e.state = n).window = null, (r = h(e, t)) !== N && (e.state = null), r) : U;
				}
				var l, f, c = !0;
				function j(e) {
					if (c) {
						var t;
						for (l = new I.Buf32(512), f = new I.Buf32(32), t = 0; t < 144;) e.lens[t++] = 8;
						for (; t < 256;) e.lens[t++] = 9;
						for (; t < 280;) e.lens[t++] = 7;
						for (; t < 288;) e.lens[t++] = 8;
						for (T(D, e.lens, 0, 288, l, 0, e.work, { bits: 9 }), t = 0; t < 32;) e.lens[t++] = 5;
						T(F, e.lens, 0, 32, f, 0, e.work, { bits: 5 }), c = !1;
					}
					e.lencode = l, e.lenbits = 9, e.distcode = f, e.distbits = 5;
				}
				function Z(e, t, r, n) {
					var i, s = e.state;
					return null === s.window && (s.wsize = 1 << s.wbits, s.wnext = 0, s.whave = 0, s.window = new I.Buf8(s.wsize)), n >= s.wsize ? (I.arraySet(s.window, t, r - s.wsize, s.wsize, 0), s.wnext = 0, s.whave = s.wsize) : (n < (i = s.wsize - s.wnext) && (i = n), I.arraySet(s.window, t, r - n, i, s.wnext), (n -= i) ? (I.arraySet(s.window, t, r - n, n, 0), s.wnext = n, s.whave = s.wsize) : (s.wnext += i, s.wnext === s.wsize && (s.wnext = 0), s.whave < s.wsize && (s.whave += i))), 0;
				}
				r.inflateReset = o, r.inflateReset2 = h, r.inflateResetKeep = a, r.inflateInit = function(e) {
					return u(e, 15);
				}, r.inflateInit2 = u, r.inflate = function(e, t) {
					var r, n, i, s, a, o, h, u, l, f, c, d, p, m, _, g, b, v, y, w, k, x, S, z, C = 0, E = new I.Buf8(4), A = [
						16,
						17,
						18,
						0,
						8,
						7,
						9,
						6,
						10,
						5,
						11,
						4,
						12,
						3,
						13,
						2,
						14,
						1,
						15
					];
					if (!e || !e.state || !e.output || !e.input && 0 !== e.avail_in) return U;
					12 === (r = e.state).mode && (r.mode = 13), a = e.next_out, i = e.output, h = e.avail_out, s = e.next_in, n = e.input, o = e.avail_in, u = r.hold, l = r.bits, f = o, c = h, x = N;
					e: for (;;) switch (r.mode) {
						case P:
							if (0 === r.wrap) {
								r.mode = 13;
								break;
							}
							for (; l < 16;) {
								if (0 === o) break e;
								o--, u += n[s++] << l, l += 8;
							}
							if (2 & r.wrap && 35615 === u) {
								E[r.check = 0] = 255 & u, E[1] = u >>> 8 & 255, r.check = B(r.check, E, 2, 0), l = u = 0, r.mode = 2;
								break;
							}
							if (r.flags = 0, r.head && (r.head.done = !1), !(1 & r.wrap) || (((255 & u) << 8) + (u >> 8)) % 31) {
								e.msg = "incorrect header check", r.mode = 30;
								break;
							}
							if (8 != (15 & u)) {
								e.msg = "unknown compression method", r.mode = 30;
								break;
							}
							if (l -= 4, k = 8 + (15 & (u >>>= 4)), 0 === r.wbits) r.wbits = k;
							else if (k > r.wbits) {
								e.msg = "invalid window size", r.mode = 30;
								break;
							}
							r.dmax = 1 << k, e.adler = r.check = 1, r.mode = 512 & u ? 10 : 12, l = u = 0;
							break;
						case 2:
							for (; l < 16;) {
								if (0 === o) break e;
								o--, u += n[s++] << l, l += 8;
							}
							if (r.flags = u, 8 != (255 & r.flags)) {
								e.msg = "unknown compression method", r.mode = 30;
								break;
							}
							if (57344 & r.flags) {
								e.msg = "unknown header flags set", r.mode = 30;
								break;
							}
							r.head && (r.head.text = u >> 8 & 1), 512 & r.flags && (E[0] = 255 & u, E[1] = u >>> 8 & 255, r.check = B(r.check, E, 2, 0)), l = u = 0, r.mode = 3;
						case 3:
							for (; l < 32;) {
								if (0 === o) break e;
								o--, u += n[s++] << l, l += 8;
							}
							r.head && (r.head.time = u), 512 & r.flags && (E[0] = 255 & u, E[1] = u >>> 8 & 255, E[2] = u >>> 16 & 255, E[3] = u >>> 24 & 255, r.check = B(r.check, E, 4, 0)), l = u = 0, r.mode = 4;
						case 4:
							for (; l < 16;) {
								if (0 === o) break e;
								o--, u += n[s++] << l, l += 8;
							}
							r.head && (r.head.xflags = 255 & u, r.head.os = u >> 8), 512 & r.flags && (E[0] = 255 & u, E[1] = u >>> 8 & 255, r.check = B(r.check, E, 2, 0)), l = u = 0, r.mode = 5;
						case 5:
							if (1024 & r.flags) {
								for (; l < 16;) {
									if (0 === o) break e;
									o--, u += n[s++] << l, l += 8;
								}
								r.length = u, r.head && (r.head.extra_len = u), 512 & r.flags && (E[0] = 255 & u, E[1] = u >>> 8 & 255, r.check = B(r.check, E, 2, 0)), l = u = 0;
							} else r.head && (r.head.extra = null);
							r.mode = 6;
						case 6:
							if (1024 & r.flags && (o < (d = r.length) && (d = o), d && (r.head && (k = r.head.extra_len - r.length, r.head.extra || (r.head.extra = new Array(r.head.extra_len)), I.arraySet(r.head.extra, n, s, d, k)), 512 & r.flags && (r.check = B(r.check, n, d, s)), o -= d, s += d, r.length -= d), r.length)) break e;
							r.length = 0, r.mode = 7;
						case 7:
							if (2048 & r.flags) {
								if (0 === o) break e;
								for (d = 0; k = n[s + d++], r.head && k && r.length < 65536 && (r.head.name += String.fromCharCode(k)), k && d < o;);
								if (512 & r.flags && (r.check = B(r.check, n, d, s)), o -= d, s += d, k) break e;
							} else r.head && (r.head.name = null);
							r.length = 0, r.mode = 8;
						case 8:
							if (4096 & r.flags) {
								if (0 === o) break e;
								for (d = 0; k = n[s + d++], r.head && k && r.length < 65536 && (r.head.comment += String.fromCharCode(k)), k && d < o;);
								if (512 & r.flags && (r.check = B(r.check, n, d, s)), o -= d, s += d, k) break e;
							} else r.head && (r.head.comment = null);
							r.mode = 9;
						case 9:
							if (512 & r.flags) {
								for (; l < 16;) {
									if (0 === o) break e;
									o--, u += n[s++] << l, l += 8;
								}
								if (u !== (65535 & r.check)) {
									e.msg = "header crc mismatch", r.mode = 30;
									break;
								}
								l = u = 0;
							}
							r.head && (r.head.hcrc = r.flags >> 9 & 1, r.head.done = !0), e.adler = r.check = 0, r.mode = 12;
							break;
						case 10:
							for (; l < 32;) {
								if (0 === o) break e;
								o--, u += n[s++] << l, l += 8;
							}
							e.adler = r.check = L(u), l = u = 0, r.mode = 11;
						case 11:
							if (0 === r.havedict) return e.next_out = a, e.avail_out = h, e.next_in = s, e.avail_in = o, r.hold = u, r.bits = l, 2;
							e.adler = r.check = 1, r.mode = 12;
						case 12: if (5 === t || 6 === t) break e;
						case 13:
							if (r.last) {
								u >>>= 7 & l, l -= 7 & l, r.mode = 27;
								break;
							}
							for (; l < 3;) {
								if (0 === o) break e;
								o--, u += n[s++] << l, l += 8;
							}
							switch (r.last = 1 & u, l -= 1, 3 & (u >>>= 1)) {
								case 0:
									r.mode = 14;
									break;
								case 1:
									if (j(r), r.mode = 20, 6 !== t) break;
									u >>>= 2, l -= 2;
									break e;
								case 2:
									r.mode = 17;
									break;
								case 3: e.msg = "invalid block type", r.mode = 30;
							}
							u >>>= 2, l -= 2;
							break;
						case 14:
							for (u >>>= 7 & l, l -= 7 & l; l < 32;) {
								if (0 === o) break e;
								o--, u += n[s++] << l, l += 8;
							}
							if ((65535 & u) != (u >>> 16 ^ 65535)) {
								e.msg = "invalid stored block lengths", r.mode = 30;
								break;
							}
							if (r.length = 65535 & u, l = u = 0, r.mode = 15, 6 === t) break e;
						case 15: r.mode = 16;
						case 16:
							if (d = r.length) {
								if (o < d && (d = o), h < d && (d = h), 0 === d) break e;
								I.arraySet(i, n, s, d, a), o -= d, s += d, h -= d, a += d, r.length -= d;
								break;
							}
							r.mode = 12;
							break;
						case 17:
							for (; l < 14;) {
								if (0 === o) break e;
								o--, u += n[s++] << l, l += 8;
							}
							if (r.nlen = 257 + (31 & u), u >>>= 5, l -= 5, r.ndist = 1 + (31 & u), u >>>= 5, l -= 5, r.ncode = 4 + (15 & u), u >>>= 4, l -= 4, 286 < r.nlen || 30 < r.ndist) {
								e.msg = "too many length or distance symbols", r.mode = 30;
								break;
							}
							r.have = 0, r.mode = 18;
						case 18:
							for (; r.have < r.ncode;) {
								for (; l < 3;) {
									if (0 === o) break e;
									o--, u += n[s++] << l, l += 8;
								}
								r.lens[A[r.have++]] = 7 & u, u >>>= 3, l -= 3;
							}
							for (; r.have < 19;) r.lens[A[r.have++]] = 0;
							if (r.lencode = r.lendyn, r.lenbits = 7, S = { bits: r.lenbits }, x = T(0, r.lens, 0, 19, r.lencode, 0, r.work, S), r.lenbits = S.bits, x) {
								e.msg = "invalid code lengths set", r.mode = 30;
								break;
							}
							r.have = 0, r.mode = 19;
						case 19:
							for (; r.have < r.nlen + r.ndist;) {
								for (; g = (C = r.lencode[u & (1 << r.lenbits) - 1]) >>> 16 & 255, b = 65535 & C, !((_ = C >>> 24) <= l);) {
									if (0 === o) break e;
									o--, u += n[s++] << l, l += 8;
								}
								if (b < 16) u >>>= _, l -= _, r.lens[r.have++] = b;
								else {
									if (16 === b) {
										for (z = _ + 2; l < z;) {
											if (0 === o) break e;
											o--, u += n[s++] << l, l += 8;
										}
										if (u >>>= _, l -= _, 0 === r.have) {
											e.msg = "invalid bit length repeat", r.mode = 30;
											break;
										}
										k = r.lens[r.have - 1], d = 3 + (3 & u), u >>>= 2, l -= 2;
									} else if (17 === b) {
										for (z = _ + 3; l < z;) {
											if (0 === o) break e;
											o--, u += n[s++] << l, l += 8;
										}
										l -= _, k = 0, d = 3 + (7 & (u >>>= _)), u >>>= 3, l -= 3;
									} else {
										for (z = _ + 7; l < z;) {
											if (0 === o) break e;
											o--, u += n[s++] << l, l += 8;
										}
										l -= _, k = 0, d = 11 + (127 & (u >>>= _)), u >>>= 7, l -= 7;
									}
									if (r.have + d > r.nlen + r.ndist) {
										e.msg = "invalid bit length repeat", r.mode = 30;
										break;
									}
									for (; d--;) r.lens[r.have++] = k;
								}
							}
							if (30 === r.mode) break;
							if (0 === r.lens[256]) {
								e.msg = "invalid code -- missing end-of-block", r.mode = 30;
								break;
							}
							if (r.lenbits = 9, S = { bits: r.lenbits }, x = T(D, r.lens, 0, r.nlen, r.lencode, 0, r.work, S), r.lenbits = S.bits, x) {
								e.msg = "invalid literal/lengths set", r.mode = 30;
								break;
							}
							if (r.distbits = 6, r.distcode = r.distdyn, S = { bits: r.distbits }, x = T(F, r.lens, r.nlen, r.ndist, r.distcode, 0, r.work, S), r.distbits = S.bits, x) {
								e.msg = "invalid distances set", r.mode = 30;
								break;
							}
							if (r.mode = 20, 6 === t) break e;
						case 20: r.mode = 21;
						case 21:
							if (6 <= o && 258 <= h) {
								e.next_out = a, e.avail_out = h, e.next_in = s, e.avail_in = o, r.hold = u, r.bits = l, R(e, c), a = e.next_out, i = e.output, h = e.avail_out, s = e.next_in, n = e.input, o = e.avail_in, u = r.hold, l = r.bits, 12 === r.mode && (r.back = -1);
								break;
							}
							for (r.back = 0; g = (C = r.lencode[u & (1 << r.lenbits) - 1]) >>> 16 & 255, b = 65535 & C, !((_ = C >>> 24) <= l);) {
								if (0 === o) break e;
								o--, u += n[s++] << l, l += 8;
							}
							if (g && 0 == (240 & g)) {
								for (v = _, y = g, w = b; g = (C = r.lencode[w + ((u & (1 << v + y) - 1) >> v)]) >>> 16 & 255, b = 65535 & C, !(v + (_ = C >>> 24) <= l);) {
									if (0 === o) break e;
									o--, u += n[s++] << l, l += 8;
								}
								u >>>= v, l -= v, r.back += v;
							}
							if (u >>>= _, l -= _, r.back += _, r.length = b, 0 === g) {
								r.mode = 26;
								break;
							}
							if (32 & g) {
								r.back = -1, r.mode = 12;
								break;
							}
							if (64 & g) {
								e.msg = "invalid literal/length code", r.mode = 30;
								break;
							}
							r.extra = 15 & g, r.mode = 22;
						case 22:
							if (r.extra) {
								for (z = r.extra; l < z;) {
									if (0 === o) break e;
									o--, u += n[s++] << l, l += 8;
								}
								r.length += u & (1 << r.extra) - 1, u >>>= r.extra, l -= r.extra, r.back += r.extra;
							}
							r.was = r.length, r.mode = 23;
						case 23:
							for (; g = (C = r.distcode[u & (1 << r.distbits) - 1]) >>> 16 & 255, b = 65535 & C, !((_ = C >>> 24) <= l);) {
								if (0 === o) break e;
								o--, u += n[s++] << l, l += 8;
							}
							if (0 == (240 & g)) {
								for (v = _, y = g, w = b; g = (C = r.distcode[w + ((u & (1 << v + y) - 1) >> v)]) >>> 16 & 255, b = 65535 & C, !(v + (_ = C >>> 24) <= l);) {
									if (0 === o) break e;
									o--, u += n[s++] << l, l += 8;
								}
								u >>>= v, l -= v, r.back += v;
							}
							if (u >>>= _, l -= _, r.back += _, 64 & g) {
								e.msg = "invalid distance code", r.mode = 30;
								break;
							}
							r.offset = b, r.extra = 15 & g, r.mode = 24;
						case 24:
							if (r.extra) {
								for (z = r.extra; l < z;) {
									if (0 === o) break e;
									o--, u += n[s++] << l, l += 8;
								}
								r.offset += u & (1 << r.extra) - 1, u >>>= r.extra, l -= r.extra, r.back += r.extra;
							}
							if (r.offset > r.dmax) {
								e.msg = "invalid distance too far back", r.mode = 30;
								break;
							}
							r.mode = 25;
						case 25:
							if (0 === h) break e;
							if (d = c - h, r.offset > d) {
								if ((d = r.offset - d) > r.whave && r.sane) {
									e.msg = "invalid distance too far back", r.mode = 30;
									break;
								}
								p = d > r.wnext ? (d -= r.wnext, r.wsize - d) : r.wnext - d, d > r.length && (d = r.length), m = r.window;
							} else m = i, p = a - r.offset, d = r.length;
							for (h < d && (d = h), h -= d, r.length -= d; i[a++] = m[p++], --d;);
							0 === r.length && (r.mode = 21);
							break;
						case 26:
							if (0 === h) break e;
							i[a++] = r.length, h--, r.mode = 21;
							break;
						case 27:
							if (r.wrap) {
								for (; l < 32;) {
									if (0 === o) break e;
									o--, u |= n[s++] << l, l += 8;
								}
								if (c -= h, e.total_out += c, r.total += c, c && (e.adler = r.check = r.flags ? B(r.check, i, c, a - c) : O(r.check, i, c, a - c)), c = h, (r.flags ? u : L(u)) !== r.check) {
									e.msg = "incorrect data check", r.mode = 30;
									break;
								}
								l = u = 0;
							}
							r.mode = 28;
						case 28:
							if (r.wrap && r.flags) {
								for (; l < 32;) {
									if (0 === o) break e;
									o--, u += n[s++] << l, l += 8;
								}
								if (u !== (4294967295 & r.total)) {
									e.msg = "incorrect length check", r.mode = 30;
									break;
								}
								l = u = 0;
							}
							r.mode = 29;
						case 29:
							x = 1;
							break e;
						case 30:
							x = -3;
							break e;
						case 31: return -4;
						case 32:
						default: return U;
					}
					return e.next_out = a, e.avail_out = h, e.next_in = s, e.avail_in = o, r.hold = u, r.bits = l, (r.wsize || c !== e.avail_out && r.mode < 30 && (r.mode < 27 || 4 !== t)) && Z(e, e.output, e.next_out, c - e.avail_out) ? (r.mode = 31, -4) : (f -= e.avail_in, c -= e.avail_out, e.total_in += f, e.total_out += c, r.total += c, r.wrap && c && (e.adler = r.check = r.flags ? B(r.check, i, c, e.next_out - c) : O(r.check, i, c, e.next_out - c)), e.data_type = r.bits + (r.last ? 64 : 0) + (12 === r.mode ? 128 : 0) + (20 === r.mode || 15 === r.mode ? 256 : 0), (0 == f && 0 === c || 4 === t) && x === N && (x = -5), x);
				}, r.inflateEnd = function(e) {
					if (!e || !e.state) return U;
					var t = e.state;
					return t.window && (t.window = null), e.state = null, N;
				}, r.inflateGetHeader = function(e, t) {
					var r;
					return e && e.state ? 0 == (2 & (r = e.state).wrap) ? U : ((r.head = t).done = !1, N) : U;
				}, r.inflateSetDictionary = function(e, t) {
					var r, n = t.length;
					return e && e.state ? 0 !== (r = e.state).wrap && 11 !== r.mode ? U : 11 === r.mode && O(1, t, n, 0) !== r.check ? -3 : Z(e, t, n, n) ? (r.mode = 31, -4) : (r.havedict = 1, N) : U;
				}, r.inflateInfo = "pako inflate (from Nodeca project)";
			}, {
				"../utils/common": 41,
				"./adler32": 43,
				"./crc32": 45,
				"./inffast": 48,
				"./inftrees": 50
			}],
			50: [function(e, t, r) {
				"use strict";
				var D = e("../utils/common"), F = [
					3,
					4,
					5,
					6,
					7,
					8,
					9,
					10,
					11,
					13,
					15,
					17,
					19,
					23,
					27,
					31,
					35,
					43,
					51,
					59,
					67,
					83,
					99,
					115,
					131,
					163,
					195,
					227,
					258,
					0,
					0
				], N = [
					16,
					16,
					16,
					16,
					16,
					16,
					16,
					16,
					17,
					17,
					17,
					17,
					18,
					18,
					18,
					18,
					19,
					19,
					19,
					19,
					20,
					20,
					20,
					20,
					21,
					21,
					21,
					21,
					16,
					72,
					78
				], U = [
					1,
					2,
					3,
					4,
					5,
					7,
					9,
					13,
					17,
					25,
					33,
					49,
					65,
					97,
					129,
					193,
					257,
					385,
					513,
					769,
					1025,
					1537,
					2049,
					3073,
					4097,
					6145,
					8193,
					12289,
					16385,
					24577,
					0,
					0
				], P = [
					16,
					16,
					16,
					16,
					17,
					17,
					18,
					18,
					19,
					19,
					20,
					20,
					21,
					21,
					22,
					22,
					23,
					23,
					24,
					24,
					25,
					25,
					26,
					26,
					27,
					27,
					28,
					28,
					29,
					29,
					64,
					64
				];
				t.exports = function(e, t, r, n, i, s, a, o) {
					var h, u, l, f, c, d, p, m, _, g = o.bits, b = 0, v = 0, y = 0, w = 0, k = 0, x = 0, S = 0, z = 0, C = 0, E = 0, A = null, I = 0, O = new D.Buf16(16), B = new D.Buf16(16), R = null, T = 0;
					for (b = 0; b <= 15; b++) O[b] = 0;
					for (v = 0; v < n; v++) O[t[r + v]]++;
					for (k = g, w = 15; 1 <= w && 0 === O[w]; w--);
					if (w < k && (k = w), 0 === w) return i[s++] = 20971520, i[s++] = 20971520, o.bits = 1, 0;
					for (y = 1; y < w && 0 === O[y]; y++);
					for (k < y && (k = y), b = z = 1; b <= 15; b++) if (z <<= 1, (z -= O[b]) < 0) return -1;
					if (0 < z && (0 === e || 1 !== w)) return -1;
					for (B[1] = 0, b = 1; b < 15; b++) B[b + 1] = B[b] + O[b];
					for (v = 0; v < n; v++) 0 !== t[r + v] && (a[B[t[r + v]]++] = v);
					if (d = 0 === e ? (A = R = a, 19) : 1 === e ? (A = F, I -= 257, R = N, T -= 257, 256) : (A = U, R = P, -1), b = y, c = s, S = v = E = 0, l = -1, f = (C = 1 << (x = k)) - 1, 1 === e && 852 < C || 2 === e && 592 < C) return 1;
					for (;;) {
						for (p = b - S, _ = a[v] < d ? (m = 0, a[v]) : a[v] > d ? (m = R[T + a[v]], A[I + a[v]]) : (m = 96, 0), h = 1 << b - S, y = u = 1 << x; i[c + (E >> S) + (u -= h)] = p << 24 | m << 16 | _ | 0, 0 !== u;);
						for (h = 1 << b - 1; E & h;) h >>= 1;
						if (0 !== h ? (E &= h - 1, E += h) : E = 0, v++, 0 == --O[b]) {
							if (b === w) break;
							b = t[r + a[v]];
						}
						if (k < b && (E & f) !== l) {
							for (0 === S && (S = k), c += y, z = 1 << (x = b - S); x + S < w && !((z -= O[x + S]) <= 0);) x++, z <<= 1;
							if (C += 1 << x, 1 === e && 852 < C || 2 === e && 592 < C) return 1;
							i[l = E & f] = k << 24 | x << 16 | c - s | 0;
						}
					}
					return 0 !== E && (i[c + E] = b - S << 24 | 4194304), o.bits = k, 0;
				};
			}, { "../utils/common": 41 }],
			51: [function(e, t, r) {
				"use strict";
				t.exports = {
					2: "need dictionary",
					1: "stream end",
					0: "",
					"-1": "file error",
					"-2": "stream error",
					"-3": "data error",
					"-4": "insufficient memory",
					"-5": "buffer error",
					"-6": "incompatible version"
				};
			}, {}],
			52: [function(e, t, r) {
				"use strict";
				var i = e("../utils/common"), o = 0, h = 1;
				function n(e) {
					for (var t = e.length; 0 <= --t;) e[t] = 0;
				}
				var s = 0, a = 29, u = 256, l = u + 1 + a, f = 30, c = 19, _ = 2 * l + 1, g = 15, d = 16, p = 7, m = 256, b = 16, v = 17, y = 18, w = [
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					1,
					1,
					1,
					1,
					2,
					2,
					2,
					2,
					3,
					3,
					3,
					3,
					4,
					4,
					4,
					4,
					5,
					5,
					5,
					5,
					0
				], k = [
					0,
					0,
					0,
					0,
					1,
					1,
					2,
					2,
					3,
					3,
					4,
					4,
					5,
					5,
					6,
					6,
					7,
					7,
					8,
					8,
					9,
					9,
					10,
					10,
					11,
					11,
					12,
					12,
					13,
					13
				], x = [
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					0,
					2,
					3,
					7
				], S = [
					16,
					17,
					18,
					0,
					8,
					7,
					9,
					6,
					10,
					5,
					11,
					4,
					12,
					3,
					13,
					2,
					14,
					1,
					15
				], z = new Array(2 * (l + 2));
				n(z);
				var C = new Array(2 * f);
				n(C);
				var E = new Array(512);
				n(E);
				var A = new Array(256);
				n(A);
				var I = new Array(a);
				n(I);
				var O, B, R, T = new Array(f);
				function D(e, t, r, n, i) {
					this.static_tree = e, this.extra_bits = t, this.extra_base = r, this.elems = n, this.max_length = i, this.has_stree = e && e.length;
				}
				function F(e, t) {
					this.dyn_tree = e, this.max_code = 0, this.stat_desc = t;
				}
				function N(e) {
					return e < 256 ? E[e] : E[256 + (e >>> 7)];
				}
				function U(e, t) {
					e.pending_buf[e.pending++] = 255 & t, e.pending_buf[e.pending++] = t >>> 8 & 255;
				}
				function P(e, t, r) {
					e.bi_valid > d - r ? (e.bi_buf |= t << e.bi_valid & 65535, U(e, e.bi_buf), e.bi_buf = t >> d - e.bi_valid, e.bi_valid += r - d) : (e.bi_buf |= t << e.bi_valid & 65535, e.bi_valid += r);
				}
				function L(e, t, r) {
					P(e, r[2 * t], r[2 * t + 1]);
				}
				function j(e, t) {
					for (var r = 0; r |= 1 & e, e >>>= 1, r <<= 1, 0 < --t;);
					return r >>> 1;
				}
				function Z(e, t, r) {
					var n, i, s = new Array(g + 1), a = 0;
					for (n = 1; n <= g; n++) s[n] = a = a + r[n - 1] << 1;
					for (i = 0; i <= t; i++) {
						var o = e[2 * i + 1];
						0 !== o && (e[2 * i] = j(s[o]++, o));
					}
				}
				function W(e) {
					var t;
					for (t = 0; t < l; t++) e.dyn_ltree[2 * t] = 0;
					for (t = 0; t < f; t++) e.dyn_dtree[2 * t] = 0;
					for (t = 0; t < c; t++) e.bl_tree[2 * t] = 0;
					e.dyn_ltree[2 * m] = 1, e.opt_len = e.static_len = 0, e.last_lit = e.matches = 0;
				}
				function M(e) {
					8 < e.bi_valid ? U(e, e.bi_buf) : 0 < e.bi_valid && (e.pending_buf[e.pending++] = e.bi_buf), e.bi_buf = 0, e.bi_valid = 0;
				}
				function H(e, t, r, n) {
					var i = 2 * t, s = 2 * r;
					return e[i] < e[s] || e[i] === e[s] && n[t] <= n[r];
				}
				function G(e, t, r) {
					for (var n = e.heap[r], i = r << 1; i <= e.heap_len && (i < e.heap_len && H(t, e.heap[i + 1], e.heap[i], e.depth) && i++, !H(t, n, e.heap[i], e.depth));) e.heap[r] = e.heap[i], r = i, i <<= 1;
					e.heap[r] = n;
				}
				function K(e, t, r) {
					var n, i, s, a, o = 0;
					if (0 !== e.last_lit) for (; n = e.pending_buf[e.d_buf + 2 * o] << 8 | e.pending_buf[e.d_buf + 2 * o + 1], i = e.pending_buf[e.l_buf + o], o++, 0 === n ? L(e, i, t) : (L(e, (s = A[i]) + u + 1, t), 0 !== (a = w[s]) && P(e, i -= I[s], a), L(e, s = N(--n), r), 0 !== (a = k[s]) && P(e, n -= T[s], a)), o < e.last_lit;);
					L(e, m, t);
				}
				function Y(e, t) {
					var r, n, i, s = t.dyn_tree, a = t.stat_desc.static_tree, o = t.stat_desc.has_stree, h = t.stat_desc.elems, u = -1;
					for (e.heap_len = 0, e.heap_max = _, r = 0; r < h; r++) 0 !== s[2 * r] ? (e.heap[++e.heap_len] = u = r, e.depth[r] = 0) : s[2 * r + 1] = 0;
					for (; e.heap_len < 2;) s[2 * (i = e.heap[++e.heap_len] = u < 2 ? ++u : 0)] = 1, e.depth[i] = 0, e.opt_len--, o && (e.static_len -= a[2 * i + 1]);
					for (t.max_code = u, r = e.heap_len >> 1; 1 <= r; r--) G(e, s, r);
					for (i = h; r = e.heap[1], e.heap[1] = e.heap[e.heap_len--], G(e, s, 1), n = e.heap[1], e.heap[--e.heap_max] = r, e.heap[--e.heap_max] = n, s[2 * i] = s[2 * r] + s[2 * n], e.depth[i] = (e.depth[r] >= e.depth[n] ? e.depth[r] : e.depth[n]) + 1, s[2 * r + 1] = s[2 * n + 1] = i, e.heap[1] = i++, G(e, s, 1), 2 <= e.heap_len;);
					e.heap[--e.heap_max] = e.heap[1], function(e, t) {
						var r, n, i, s, a, o, h = t.dyn_tree, u = t.max_code, l = t.stat_desc.static_tree, f = t.stat_desc.has_stree, c = t.stat_desc.extra_bits, d = t.stat_desc.extra_base, p = t.stat_desc.max_length, m = 0;
						for (s = 0; s <= g; s++) e.bl_count[s] = 0;
						for (h[2 * e.heap[e.heap_max] + 1] = 0, r = e.heap_max + 1; r < _; r++) p < (s = h[2 * h[2 * (n = e.heap[r]) + 1] + 1] + 1) && (s = p, m++), h[2 * n + 1] = s, u < n || (e.bl_count[s]++, a = 0, d <= n && (a = c[n - d]), o = h[2 * n], e.opt_len += o * (s + a), f && (e.static_len += o * (l[2 * n + 1] + a)));
						if (0 !== m) {
							do {
								for (s = p - 1; 0 === e.bl_count[s];) s--;
								e.bl_count[s]--, e.bl_count[s + 1] += 2, e.bl_count[p]--, m -= 2;
							} while (0 < m);
							for (s = p; 0 !== s; s--) for (n = e.bl_count[s]; 0 !== n;) u < (i = e.heap[--r]) || (h[2 * i + 1] !== s && (e.opt_len += (s - h[2 * i + 1]) * h[2 * i], h[2 * i + 1] = s), n--);
						}
					}(e, t), Z(s, u, e.bl_count);
				}
				function X(e, t, r) {
					var n, i, s = -1, a = t[1], o = 0, h = 7, u = 4;
					for (0 === a && (h = 138, u = 3), t[2 * (r + 1) + 1] = 65535, n = 0; n <= r; n++) i = a, a = t[2 * (n + 1) + 1], ++o < h && i === a || (o < u ? e.bl_tree[2 * i] += o : 0 !== i ? (i !== s && e.bl_tree[2 * i]++, e.bl_tree[2 * b]++) : o <= 10 ? e.bl_tree[2 * v]++ : e.bl_tree[2 * y]++, s = i, u = (o = 0) === a ? (h = 138, 3) : i === a ? (h = 6, 3) : (h = 7, 4));
				}
				function V(e, t, r) {
					var n, i, s = -1, a = t[1], o = 0, h = 7, u = 4;
					for (0 === a && (h = 138, u = 3), n = 0; n <= r; n++) if (i = a, a = t[2 * (n + 1) + 1], !(++o < h && i === a)) {
						if (o < u) for (; L(e, i, e.bl_tree), 0 != --o;);
						else 0 !== i ? (i !== s && (L(e, i, e.bl_tree), o--), L(e, b, e.bl_tree), P(e, o - 3, 2)) : o <= 10 ? (L(e, v, e.bl_tree), P(e, o - 3, 3)) : (L(e, y, e.bl_tree), P(e, o - 11, 7));
						s = i, u = (o = 0) === a ? (h = 138, 3) : i === a ? (h = 6, 3) : (h = 7, 4);
					}
				}
				n(T);
				var q = !1;
				function J(e, t, r, n) {
					P(e, (s << 1) + (n ? 1 : 0), 3), function(e, t, r, n) {
						M(e), n && (U(e, r), U(e, ~r)), i.arraySet(e.pending_buf, e.window, t, r, e.pending), e.pending += r;
					}(e, t, r, !0);
				}
				r._tr_init = function(e) {
					q || (function() {
						var e, t, r, n, i, s = new Array(g + 1);
						for (n = r = 0; n < a - 1; n++) for (I[n] = r, e = 0; e < 1 << w[n]; e++) A[r++] = n;
						for (A[r - 1] = n, n = i = 0; n < 16; n++) for (T[n] = i, e = 0; e < 1 << k[n]; e++) E[i++] = n;
						for (i >>= 7; n < f; n++) for (T[n] = i << 7, e = 0; e < 1 << k[n] - 7; e++) E[256 + i++] = n;
						for (t = 0; t <= g; t++) s[t] = 0;
						for (e = 0; e <= 143;) z[2 * e + 1] = 8, e++, s[8]++;
						for (; e <= 255;) z[2 * e + 1] = 9, e++, s[9]++;
						for (; e <= 279;) z[2 * e + 1] = 7, e++, s[7]++;
						for (; e <= 287;) z[2 * e + 1] = 8, e++, s[8]++;
						for (Z(z, l + 1, s), e = 0; e < f; e++) C[2 * e + 1] = 5, C[2 * e] = j(e, 5);
						O = new D(z, w, u + 1, l, g), B = new D(C, k, 0, f, g), R = new D(new Array(0), x, 0, c, p);
					}(), q = !0), e.l_desc = new F(e.dyn_ltree, O), e.d_desc = new F(e.dyn_dtree, B), e.bl_desc = new F(e.bl_tree, R), e.bi_buf = 0, e.bi_valid = 0, W(e);
				}, r._tr_stored_block = J, r._tr_flush_block = function(e, t, r, n) {
					var i, s, a = 0;
					0 < e.level ? (2 === e.strm.data_type && (e.strm.data_type = function(e) {
						var t, r = 4093624447;
						for (t = 0; t <= 31; t++, r >>>= 1) if (1 & r && 0 !== e.dyn_ltree[2 * t]) return o;
						if (0 !== e.dyn_ltree[18] || 0 !== e.dyn_ltree[20] || 0 !== e.dyn_ltree[26]) return h;
						for (t = 32; t < u; t++) if (0 !== e.dyn_ltree[2 * t]) return h;
						return o;
					}(e)), Y(e, e.l_desc), Y(e, e.d_desc), a = function(e) {
						var t;
						for (X(e, e.dyn_ltree, e.l_desc.max_code), X(e, e.dyn_dtree, e.d_desc.max_code), Y(e, e.bl_desc), t = c - 1; 3 <= t && 0 === e.bl_tree[2 * S[t] + 1]; t--);
						return e.opt_len += 3 * (t + 1) + 5 + 5 + 4, t;
					}(e), i = e.opt_len + 3 + 7 >>> 3, (s = e.static_len + 3 + 7 >>> 3) <= i && (i = s)) : i = s = r + 5, r + 4 <= i && -1 !== t ? J(e, t, r, n) : 4 === e.strategy || s === i ? (P(e, 2 + (n ? 1 : 0), 3), K(e, z, C)) : (P(e, 4 + (n ? 1 : 0), 3), function(e, t, r, n) {
						var i;
						for (P(e, t - 257, 5), P(e, r - 1, 5), P(e, n - 4, 4), i = 0; i < n; i++) P(e, e.bl_tree[2 * S[i] + 1], 3);
						V(e, e.dyn_ltree, t - 1), V(e, e.dyn_dtree, r - 1);
					}(e, e.l_desc.max_code + 1, e.d_desc.max_code + 1, a + 1), K(e, e.dyn_ltree, e.dyn_dtree)), W(e), n && M(e);
				}, r._tr_tally = function(e, t, r) {
					return e.pending_buf[e.d_buf + 2 * e.last_lit] = t >>> 8 & 255, e.pending_buf[e.d_buf + 2 * e.last_lit + 1] = 255 & t, e.pending_buf[e.l_buf + e.last_lit] = 255 & r, e.last_lit++, 0 === t ? e.dyn_ltree[2 * r]++ : (e.matches++, t--, e.dyn_ltree[2 * (A[r] + u + 1)]++, e.dyn_dtree[2 * N(t)]++), e.last_lit === e.lit_bufsize - 1;
				}, r._tr_align = function(e) {
					P(e, 2, 3), L(e, m, z), function(e) {
						16 === e.bi_valid ? (U(e, e.bi_buf), e.bi_buf = 0, e.bi_valid = 0) : 8 <= e.bi_valid && (e.pending_buf[e.pending++] = 255 & e.bi_buf, e.bi_buf >>= 8, e.bi_valid -= 8);
					}(e);
				};
			}, { "../utils/common": 41 }],
			53: [function(e, t, r) {
				"use strict";
				t.exports = function() {
					this.input = null, this.next_in = 0, this.avail_in = 0, this.total_in = 0, this.output = null, this.next_out = 0, this.avail_out = 0, this.total_out = 0, this.msg = "", this.state = null, this.data_type = 2, this.adler = 0;
				};
			}, {}],
			54: [function(e, t, r) {
				(function(e) {
					(function(r, n) {
						"use strict";
						if (!r.setImmediate) {
							var i, s, t, a, o = 1, h = {}, u = !1, l = r.document, e = Object.getPrototypeOf && Object.getPrototypeOf(r);
							e = e && e.setTimeout ? e : r, i = "[object process]" === {}.toString.call(r.process) ? function(e) {
								process.nextTick(function() {
									c(e);
								});
							} : function() {
								if (r.postMessage && !r.importScripts) {
									var e = !0, t = r.onmessage;
									return r.onmessage = function() {
										e = !1;
									}, r.postMessage("", "*"), r.onmessage = t, e;
								}
							}() ? (a = "setImmediate$" + Math.random() + "$", r.addEventListener ? r.addEventListener("message", d, !1) : r.attachEvent("onmessage", d), function(e) {
								r.postMessage(a + e, "*");
							}) : r.MessageChannel ? ((t = new MessageChannel()).port1.onmessage = function(e) {
								c(e.data);
							}, function(e) {
								t.port2.postMessage(e);
							}) : l && "onreadystatechange" in l.createElement("script") ? (s = l.documentElement, function(e) {
								var t = l.createElement("script");
								t.onreadystatechange = function() {
									c(e), t.onreadystatechange = null, s.removeChild(t), t = null;
								}, s.appendChild(t);
							}) : function(e) {
								setTimeout(c, 0, e);
							}, e.setImmediate = function(e) {
								"function" != typeof e && (e = new Function("" + e));
								for (var t = new Array(arguments.length - 1), r = 0; r < t.length; r++) t[r] = arguments[r + 1];
								return h[o] = {
									callback: e,
									args: t
								}, i(o), o++;
							}, e.clearImmediate = f;
						}
						function f(e) {
							delete h[e];
						}
						function c(e) {
							if (u) setTimeout(c, 0, e);
							else {
								var t = h[e];
								if (t) {
									u = !0;
									try {
										(function(e) {
											var t = e.callback, r = e.args;
											switch (r.length) {
												case 0:
													t();
													break;
												case 1:
													t(r[0]);
													break;
												case 2:
													t(r[0], r[1]);
													break;
												case 3:
													t(r[0], r[1], r[2]);
													break;
												default: t.apply(n, r);
											}
										})(t);
									} finally {
										f(e), u = !1;
									}
								}
							}
						}
						function d(e) {
							e.source === r && "string" == typeof e.data && 0 === e.data.indexOf(a) && c(+e.data.slice(a.length));
						}
					})("undefined" == typeof self ? void 0 === e ? this : e : self);
				}).call(this, "undefined" != typeof global ? global : "undefined" != typeof self ? self : "undefined" != typeof window ? window : {});
			}, {}]
		}, {}, [10])(10);
	});
})))();
"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
var TEXT_HALIGN;
(function(TEXT_HALIGN) {
	TEXT_HALIGN["left"] = "left";
	TEXT_HALIGN["center"] = "center";
	TEXT_HALIGN["right"] = "right";
	TEXT_HALIGN["justify"] = "justify";
})(TEXT_HALIGN || (TEXT_HALIGN = {}));
var TEXT_VALIGN;
(function(TEXT_VALIGN) {
	TEXT_VALIGN["b"] = "b";
	TEXT_VALIGN["ctr"] = "ctr";
	TEXT_VALIGN["t"] = "t";
})(TEXT_VALIGN || (TEXT_VALIGN = {}));
var OutputType;
(function(OutputType) {
	OutputType["arraybuffer"] = "arraybuffer";
	OutputType["base64"] = "base64";
	OutputType["binarystring"] = "binarystring";
	OutputType["blob"] = "blob";
	OutputType["nodebuffer"] = "nodebuffer";
	OutputType["uint8array"] = "uint8array";
})(OutputType || (OutputType = {}));
var ChartType;
(function(ChartType) {
	ChartType["area"] = "area";
	ChartType["bar"] = "bar";
	ChartType["bar3d"] = "bar3D";
	ChartType["bubble"] = "bubble";
	ChartType["bubble3d"] = "bubble3D";
	ChartType["doughnut"] = "doughnut";
	ChartType["line"] = "line";
	ChartType["pie"] = "pie";
	ChartType["radar"] = "radar";
	ChartType["scatter"] = "scatter";
})(ChartType || (ChartType = {}));
var ShapeType;
(function(ShapeType) {
	ShapeType["accentBorderCallout1"] = "accentBorderCallout1";
	ShapeType["accentBorderCallout2"] = "accentBorderCallout2";
	ShapeType["accentBorderCallout3"] = "accentBorderCallout3";
	ShapeType["accentCallout1"] = "accentCallout1";
	ShapeType["accentCallout2"] = "accentCallout2";
	ShapeType["accentCallout3"] = "accentCallout3";
	ShapeType["actionButtonBackPrevious"] = "actionButtonBackPrevious";
	ShapeType["actionButtonBeginning"] = "actionButtonBeginning";
	ShapeType["actionButtonBlank"] = "actionButtonBlank";
	ShapeType["actionButtonDocument"] = "actionButtonDocument";
	ShapeType["actionButtonEnd"] = "actionButtonEnd";
	ShapeType["actionButtonForwardNext"] = "actionButtonForwardNext";
	ShapeType["actionButtonHelp"] = "actionButtonHelp";
	ShapeType["actionButtonHome"] = "actionButtonHome";
	ShapeType["actionButtonInformation"] = "actionButtonInformation";
	ShapeType["actionButtonMovie"] = "actionButtonMovie";
	ShapeType["actionButtonReturn"] = "actionButtonReturn";
	ShapeType["actionButtonSound"] = "actionButtonSound";
	ShapeType["arc"] = "arc";
	ShapeType["bentArrow"] = "bentArrow";
	ShapeType["bentUpArrow"] = "bentUpArrow";
	ShapeType["bevel"] = "bevel";
	ShapeType["blockArc"] = "blockArc";
	ShapeType["borderCallout1"] = "borderCallout1";
	ShapeType["borderCallout2"] = "borderCallout2";
	ShapeType["borderCallout3"] = "borderCallout3";
	ShapeType["bracePair"] = "bracePair";
	ShapeType["bracketPair"] = "bracketPair";
	ShapeType["callout1"] = "callout1";
	ShapeType["callout2"] = "callout2";
	ShapeType["callout3"] = "callout3";
	ShapeType["can"] = "can";
	ShapeType["chartPlus"] = "chartPlus";
	ShapeType["chartStar"] = "chartStar";
	ShapeType["chartX"] = "chartX";
	ShapeType["chevron"] = "chevron";
	ShapeType["chord"] = "chord";
	ShapeType["circularArrow"] = "circularArrow";
	ShapeType["cloud"] = "cloud";
	ShapeType["cloudCallout"] = "cloudCallout";
	ShapeType["corner"] = "corner";
	ShapeType["cornerTabs"] = "cornerTabs";
	ShapeType["cube"] = "cube";
	ShapeType["curvedDownArrow"] = "curvedDownArrow";
	ShapeType["curvedLeftArrow"] = "curvedLeftArrow";
	ShapeType["curvedRightArrow"] = "curvedRightArrow";
	ShapeType["curvedUpArrow"] = "curvedUpArrow";
	ShapeType["custGeom"] = "custGeom";
	ShapeType["decagon"] = "decagon";
	ShapeType["diagStripe"] = "diagStripe";
	ShapeType["diamond"] = "diamond";
	ShapeType["dodecagon"] = "dodecagon";
	ShapeType["donut"] = "donut";
	ShapeType["doubleWave"] = "doubleWave";
	ShapeType["downArrow"] = "downArrow";
	ShapeType["downArrowCallout"] = "downArrowCallout";
	ShapeType["ellipse"] = "ellipse";
	ShapeType["ellipseRibbon"] = "ellipseRibbon";
	ShapeType["ellipseRibbon2"] = "ellipseRibbon2";
	ShapeType["flowChartAlternateProcess"] = "flowChartAlternateProcess";
	ShapeType["flowChartCollate"] = "flowChartCollate";
	ShapeType["flowChartConnector"] = "flowChartConnector";
	ShapeType["flowChartDecision"] = "flowChartDecision";
	ShapeType["flowChartDelay"] = "flowChartDelay";
	ShapeType["flowChartDisplay"] = "flowChartDisplay";
	ShapeType["flowChartDocument"] = "flowChartDocument";
	ShapeType["flowChartExtract"] = "flowChartExtract";
	ShapeType["flowChartInputOutput"] = "flowChartInputOutput";
	ShapeType["flowChartInternalStorage"] = "flowChartInternalStorage";
	ShapeType["flowChartMagneticDisk"] = "flowChartMagneticDisk";
	ShapeType["flowChartMagneticDrum"] = "flowChartMagneticDrum";
	ShapeType["flowChartMagneticTape"] = "flowChartMagneticTape";
	ShapeType["flowChartManualInput"] = "flowChartManualInput";
	ShapeType["flowChartManualOperation"] = "flowChartManualOperation";
	ShapeType["flowChartMerge"] = "flowChartMerge";
	ShapeType["flowChartMultidocument"] = "flowChartMultidocument";
	ShapeType["flowChartOfflineStorage"] = "flowChartOfflineStorage";
	ShapeType["flowChartOffpageConnector"] = "flowChartOffpageConnector";
	ShapeType["flowChartOnlineStorage"] = "flowChartOnlineStorage";
	ShapeType["flowChartOr"] = "flowChartOr";
	ShapeType["flowChartPredefinedProcess"] = "flowChartPredefinedProcess";
	ShapeType["flowChartPreparation"] = "flowChartPreparation";
	ShapeType["flowChartProcess"] = "flowChartProcess";
	ShapeType["flowChartPunchedCard"] = "flowChartPunchedCard";
	ShapeType["flowChartPunchedTape"] = "flowChartPunchedTape";
	ShapeType["flowChartSort"] = "flowChartSort";
	ShapeType["flowChartSummingJunction"] = "flowChartSummingJunction";
	ShapeType["flowChartTerminator"] = "flowChartTerminator";
	ShapeType["folderCorner"] = "folderCorner";
	ShapeType["frame"] = "frame";
	ShapeType["funnel"] = "funnel";
	ShapeType["gear6"] = "gear6";
	ShapeType["gear9"] = "gear9";
	ShapeType["halfFrame"] = "halfFrame";
	ShapeType["heart"] = "heart";
	ShapeType["heptagon"] = "heptagon";
	ShapeType["hexagon"] = "hexagon";
	ShapeType["homePlate"] = "homePlate";
	ShapeType["horizontalScroll"] = "horizontalScroll";
	ShapeType["irregularSeal1"] = "irregularSeal1";
	ShapeType["irregularSeal2"] = "irregularSeal2";
	ShapeType["leftArrow"] = "leftArrow";
	ShapeType["leftArrowCallout"] = "leftArrowCallout";
	ShapeType["leftBrace"] = "leftBrace";
	ShapeType["leftBracket"] = "leftBracket";
	ShapeType["leftCircularArrow"] = "leftCircularArrow";
	ShapeType["leftRightArrow"] = "leftRightArrow";
	ShapeType["leftRightArrowCallout"] = "leftRightArrowCallout";
	ShapeType["leftRightCircularArrow"] = "leftRightCircularArrow";
	ShapeType["leftRightRibbon"] = "leftRightRibbon";
	ShapeType["leftRightUpArrow"] = "leftRightUpArrow";
	ShapeType["leftUpArrow"] = "leftUpArrow";
	ShapeType["lightningBolt"] = "lightningBolt";
	ShapeType["line"] = "line";
	ShapeType["lineInv"] = "lineInv";
	ShapeType["mathDivide"] = "mathDivide";
	ShapeType["mathEqual"] = "mathEqual";
	ShapeType["mathMinus"] = "mathMinus";
	ShapeType["mathMultiply"] = "mathMultiply";
	ShapeType["mathNotEqual"] = "mathNotEqual";
	ShapeType["mathPlus"] = "mathPlus";
	ShapeType["moon"] = "moon";
	ShapeType["noSmoking"] = "noSmoking";
	ShapeType["nonIsoscelesTrapezoid"] = "nonIsoscelesTrapezoid";
	ShapeType["notchedRightArrow"] = "notchedRightArrow";
	ShapeType["octagon"] = "octagon";
	ShapeType["parallelogram"] = "parallelogram";
	ShapeType["pentagon"] = "pentagon";
	ShapeType["pie"] = "pie";
	ShapeType["pieWedge"] = "pieWedge";
	ShapeType["plaque"] = "plaque";
	ShapeType["plaqueTabs"] = "plaqueTabs";
	ShapeType["plus"] = "plus";
	ShapeType["quadArrow"] = "quadArrow";
	ShapeType["quadArrowCallout"] = "quadArrowCallout";
	ShapeType["rect"] = "rect";
	ShapeType["ribbon"] = "ribbon";
	ShapeType["ribbon2"] = "ribbon2";
	ShapeType["rightArrow"] = "rightArrow";
	ShapeType["rightArrowCallout"] = "rightArrowCallout";
	ShapeType["rightBrace"] = "rightBrace";
	ShapeType["rightBracket"] = "rightBracket";
	ShapeType["round1Rect"] = "round1Rect";
	ShapeType["round2DiagRect"] = "round2DiagRect";
	ShapeType["round2SameRect"] = "round2SameRect";
	ShapeType["roundRect"] = "roundRect";
	ShapeType["rtTriangle"] = "rtTriangle";
	ShapeType["smileyFace"] = "smileyFace";
	ShapeType["snip1Rect"] = "snip1Rect";
	ShapeType["snip2DiagRect"] = "snip2DiagRect";
	ShapeType["snip2SameRect"] = "snip2SameRect";
	ShapeType["snipRoundRect"] = "snipRoundRect";
	ShapeType["squareTabs"] = "squareTabs";
	ShapeType["star10"] = "star10";
	ShapeType["star12"] = "star12";
	ShapeType["star16"] = "star16";
	ShapeType["star24"] = "star24";
	ShapeType["star32"] = "star32";
	ShapeType["star4"] = "star4";
	ShapeType["star5"] = "star5";
	ShapeType["star6"] = "star6";
	ShapeType["star7"] = "star7";
	ShapeType["star8"] = "star8";
	ShapeType["stripedRightArrow"] = "stripedRightArrow";
	ShapeType["sun"] = "sun";
	ShapeType["swooshArrow"] = "swooshArrow";
	ShapeType["teardrop"] = "teardrop";
	ShapeType["trapezoid"] = "trapezoid";
	ShapeType["triangle"] = "triangle";
	ShapeType["upArrow"] = "upArrow";
	ShapeType["upArrowCallout"] = "upArrowCallout";
	ShapeType["upDownArrow"] = "upDownArrow";
	ShapeType["upDownArrowCallout"] = "upDownArrowCallout";
	ShapeType["uturnArrow"] = "uturnArrow";
	ShapeType["verticalScroll"] = "verticalScroll";
	ShapeType["wave"] = "wave";
	ShapeType["wedgeEllipseCallout"] = "wedgeEllipseCallout";
	ShapeType["wedgeRectCallout"] = "wedgeRectCallout";
	ShapeType["wedgeRoundRectCallout"] = "wedgeRoundRectCallout";
})(ShapeType || (ShapeType = {}));
/**
* TODO: FUTURE: v4.0: rename to `ThemeColor`
*/
var SchemeColor;
(function(SchemeColor) {
	SchemeColor["text1"] = "tx1";
	SchemeColor["text2"] = "tx2";
	SchemeColor["background1"] = "bg1";
	SchemeColor["background2"] = "bg2";
	SchemeColor["accent1"] = "accent1";
	SchemeColor["accent2"] = "accent2";
	SchemeColor["accent3"] = "accent3";
	SchemeColor["accent4"] = "accent4";
	SchemeColor["accent5"] = "accent5";
	SchemeColor["accent6"] = "accent6";
})(SchemeColor || (SchemeColor = {}));
var AlignH;
(function(AlignH) {
	AlignH["left"] = "left";
	AlignH["center"] = "center";
	AlignH["right"] = "right";
	AlignH["justify"] = "justify";
})(AlignH || (AlignH = {}));
var AlignV;
(function(AlignV) {
	AlignV["top"] = "top";
	AlignV["middle"] = "middle";
	AlignV["bottom"] = "bottom";
})(AlignV || (AlignV = {}));
var SHAPE_TYPE;
(function(SHAPE_TYPE) {
	SHAPE_TYPE["ACTION_BUTTON_BACK_OR_PREVIOUS"] = "actionButtonBackPrevious";
	SHAPE_TYPE["ACTION_BUTTON_BEGINNING"] = "actionButtonBeginning";
	SHAPE_TYPE["ACTION_BUTTON_CUSTOM"] = "actionButtonBlank";
	SHAPE_TYPE["ACTION_BUTTON_DOCUMENT"] = "actionButtonDocument";
	SHAPE_TYPE["ACTION_BUTTON_END"] = "actionButtonEnd";
	SHAPE_TYPE["ACTION_BUTTON_FORWARD_OR_NEXT"] = "actionButtonForwardNext";
	SHAPE_TYPE["ACTION_BUTTON_HELP"] = "actionButtonHelp";
	SHAPE_TYPE["ACTION_BUTTON_HOME"] = "actionButtonHome";
	SHAPE_TYPE["ACTION_BUTTON_INFORMATION"] = "actionButtonInformation";
	SHAPE_TYPE["ACTION_BUTTON_MOVIE"] = "actionButtonMovie";
	SHAPE_TYPE["ACTION_BUTTON_RETURN"] = "actionButtonReturn";
	SHAPE_TYPE["ACTION_BUTTON_SOUND"] = "actionButtonSound";
	SHAPE_TYPE["ARC"] = "arc";
	SHAPE_TYPE["BALLOON"] = "wedgeRoundRectCallout";
	SHAPE_TYPE["BENT_ARROW"] = "bentArrow";
	SHAPE_TYPE["BENT_UP_ARROW"] = "bentUpArrow";
	SHAPE_TYPE["BEVEL"] = "bevel";
	SHAPE_TYPE["BLOCK_ARC"] = "blockArc";
	SHAPE_TYPE["CAN"] = "can";
	SHAPE_TYPE["CHART_PLUS"] = "chartPlus";
	SHAPE_TYPE["CHART_STAR"] = "chartStar";
	SHAPE_TYPE["CHART_X"] = "chartX";
	SHAPE_TYPE["CHEVRON"] = "chevron";
	SHAPE_TYPE["CHORD"] = "chord";
	SHAPE_TYPE["CIRCULAR_ARROW"] = "circularArrow";
	SHAPE_TYPE["CLOUD"] = "cloud";
	SHAPE_TYPE["CLOUD_CALLOUT"] = "cloudCallout";
	SHAPE_TYPE["CORNER"] = "corner";
	SHAPE_TYPE["CORNER_TABS"] = "cornerTabs";
	SHAPE_TYPE["CROSS"] = "plus";
	SHAPE_TYPE["CUBE"] = "cube";
	SHAPE_TYPE["CURVED_DOWN_ARROW"] = "curvedDownArrow";
	SHAPE_TYPE["CURVED_DOWN_RIBBON"] = "ellipseRibbon";
	SHAPE_TYPE["CURVED_LEFT_ARROW"] = "curvedLeftArrow";
	SHAPE_TYPE["CURVED_RIGHT_ARROW"] = "curvedRightArrow";
	SHAPE_TYPE["CURVED_UP_ARROW"] = "curvedUpArrow";
	SHAPE_TYPE["CURVED_UP_RIBBON"] = "ellipseRibbon2";
	SHAPE_TYPE["CUSTOM_GEOMETRY"] = "custGeom";
	SHAPE_TYPE["DECAGON"] = "decagon";
	SHAPE_TYPE["DIAGONAL_STRIPE"] = "diagStripe";
	SHAPE_TYPE["DIAMOND"] = "diamond";
	SHAPE_TYPE["DODECAGON"] = "dodecagon";
	SHAPE_TYPE["DONUT"] = "donut";
	SHAPE_TYPE["DOUBLE_BRACE"] = "bracePair";
	SHAPE_TYPE["DOUBLE_BRACKET"] = "bracketPair";
	SHAPE_TYPE["DOUBLE_WAVE"] = "doubleWave";
	SHAPE_TYPE["DOWN_ARROW"] = "downArrow";
	SHAPE_TYPE["DOWN_ARROW_CALLOUT"] = "downArrowCallout";
	SHAPE_TYPE["DOWN_RIBBON"] = "ribbon";
	SHAPE_TYPE["EXPLOSION1"] = "irregularSeal1";
	SHAPE_TYPE["EXPLOSION2"] = "irregularSeal2";
	SHAPE_TYPE["FLOWCHART_ALTERNATE_PROCESS"] = "flowChartAlternateProcess";
	SHAPE_TYPE["FLOWCHART_CARD"] = "flowChartPunchedCard";
	SHAPE_TYPE["FLOWCHART_COLLATE"] = "flowChartCollate";
	SHAPE_TYPE["FLOWCHART_CONNECTOR"] = "flowChartConnector";
	SHAPE_TYPE["FLOWCHART_DATA"] = "flowChartInputOutput";
	SHAPE_TYPE["FLOWCHART_DECISION"] = "flowChartDecision";
	SHAPE_TYPE["FLOWCHART_DELAY"] = "flowChartDelay";
	SHAPE_TYPE["FLOWCHART_DIRECT_ACCESS_STORAGE"] = "flowChartMagneticDrum";
	SHAPE_TYPE["FLOWCHART_DISPLAY"] = "flowChartDisplay";
	SHAPE_TYPE["FLOWCHART_DOCUMENT"] = "flowChartDocument";
	SHAPE_TYPE["FLOWCHART_EXTRACT"] = "flowChartExtract";
	SHAPE_TYPE["FLOWCHART_INTERNAL_STORAGE"] = "flowChartInternalStorage";
	SHAPE_TYPE["FLOWCHART_MAGNETIC_DISK"] = "flowChartMagneticDisk";
	SHAPE_TYPE["FLOWCHART_MANUAL_INPUT"] = "flowChartManualInput";
	SHAPE_TYPE["FLOWCHART_MANUAL_OPERATION"] = "flowChartManualOperation";
	SHAPE_TYPE["FLOWCHART_MERGE"] = "flowChartMerge";
	SHAPE_TYPE["FLOWCHART_MULTIDOCUMENT"] = "flowChartMultidocument";
	SHAPE_TYPE["FLOWCHART_OFFLINE_STORAGE"] = "flowChartOfflineStorage";
	SHAPE_TYPE["FLOWCHART_OFFPAGE_CONNECTOR"] = "flowChartOffpageConnector";
	SHAPE_TYPE["FLOWCHART_OR"] = "flowChartOr";
	SHAPE_TYPE["FLOWCHART_PREDEFINED_PROCESS"] = "flowChartPredefinedProcess";
	SHAPE_TYPE["FLOWCHART_PREPARATION"] = "flowChartPreparation";
	SHAPE_TYPE["FLOWCHART_PROCESS"] = "flowChartProcess";
	SHAPE_TYPE["FLOWCHART_PUNCHED_TAPE"] = "flowChartPunchedTape";
	SHAPE_TYPE["FLOWCHART_SEQUENTIAL_ACCESS_STORAGE"] = "flowChartMagneticTape";
	SHAPE_TYPE["FLOWCHART_SORT"] = "flowChartSort";
	SHAPE_TYPE["FLOWCHART_STORED_DATA"] = "flowChartOnlineStorage";
	SHAPE_TYPE["FLOWCHART_SUMMING_JUNCTION"] = "flowChartSummingJunction";
	SHAPE_TYPE["FLOWCHART_TERMINATOR"] = "flowChartTerminator";
	SHAPE_TYPE["FOLDED_CORNER"] = "folderCorner";
	SHAPE_TYPE["FRAME"] = "frame";
	SHAPE_TYPE["FUNNEL"] = "funnel";
	SHAPE_TYPE["GEAR_6"] = "gear6";
	SHAPE_TYPE["GEAR_9"] = "gear9";
	SHAPE_TYPE["HALF_FRAME"] = "halfFrame";
	SHAPE_TYPE["HEART"] = "heart";
	SHAPE_TYPE["HEPTAGON"] = "heptagon";
	SHAPE_TYPE["HEXAGON"] = "hexagon";
	SHAPE_TYPE["HORIZONTAL_SCROLL"] = "horizontalScroll";
	SHAPE_TYPE["ISOSCELES_TRIANGLE"] = "triangle";
	SHAPE_TYPE["LEFT_ARROW"] = "leftArrow";
	SHAPE_TYPE["LEFT_ARROW_CALLOUT"] = "leftArrowCallout";
	SHAPE_TYPE["LEFT_BRACE"] = "leftBrace";
	SHAPE_TYPE["LEFT_BRACKET"] = "leftBracket";
	SHAPE_TYPE["LEFT_CIRCULAR_ARROW"] = "leftCircularArrow";
	SHAPE_TYPE["LEFT_RIGHT_ARROW"] = "leftRightArrow";
	SHAPE_TYPE["LEFT_RIGHT_ARROW_CALLOUT"] = "leftRightArrowCallout";
	SHAPE_TYPE["LEFT_RIGHT_CIRCULAR_ARROW"] = "leftRightCircularArrow";
	SHAPE_TYPE["LEFT_RIGHT_RIBBON"] = "leftRightRibbon";
	SHAPE_TYPE["LEFT_RIGHT_UP_ARROW"] = "leftRightUpArrow";
	SHAPE_TYPE["LEFT_UP_ARROW"] = "leftUpArrow";
	SHAPE_TYPE["LIGHTNING_BOLT"] = "lightningBolt";
	SHAPE_TYPE["LINE_CALLOUT_1"] = "borderCallout1";
	SHAPE_TYPE["LINE_CALLOUT_1_ACCENT_BAR"] = "accentCallout1";
	SHAPE_TYPE["LINE_CALLOUT_1_BORDER_AND_ACCENT_BAR"] = "accentBorderCallout1";
	SHAPE_TYPE["LINE_CALLOUT_1_NO_BORDER"] = "callout1";
	SHAPE_TYPE["LINE_CALLOUT_2"] = "borderCallout2";
	SHAPE_TYPE["LINE_CALLOUT_2_ACCENT_BAR"] = "accentCallout2";
	SHAPE_TYPE["LINE_CALLOUT_2_BORDER_AND_ACCENT_BAR"] = "accentBorderCallout2";
	SHAPE_TYPE["LINE_CALLOUT_2_NO_BORDER"] = "callout2";
	SHAPE_TYPE["LINE_CALLOUT_3"] = "borderCallout3";
	SHAPE_TYPE["LINE_CALLOUT_3_ACCENT_BAR"] = "accentCallout3";
	SHAPE_TYPE["LINE_CALLOUT_3_BORDER_AND_ACCENT_BAR"] = "accentBorderCallout3";
	SHAPE_TYPE["LINE_CALLOUT_3_NO_BORDER"] = "callout3";
	SHAPE_TYPE["LINE_CALLOUT_4"] = "borderCallout4";
	SHAPE_TYPE["LINE_CALLOUT_4_ACCENT_BAR"] = "accentCallout3=4";
	SHAPE_TYPE["LINE_CALLOUT_4_BORDER_AND_ACCENT_BAR"] = "accentBorderCallout4";
	SHAPE_TYPE["LINE_CALLOUT_4_NO_BORDER"] = "callout4";
	SHAPE_TYPE["LINE"] = "line";
	SHAPE_TYPE["LINE_INVERSE"] = "lineInv";
	SHAPE_TYPE["MATH_DIVIDE"] = "mathDivide";
	SHAPE_TYPE["MATH_EQUAL"] = "mathEqual";
	SHAPE_TYPE["MATH_MINUS"] = "mathMinus";
	SHAPE_TYPE["MATH_MULTIPLY"] = "mathMultiply";
	SHAPE_TYPE["MATH_NOT_EQUAL"] = "mathNotEqual";
	SHAPE_TYPE["MATH_PLUS"] = "mathPlus";
	SHAPE_TYPE["MOON"] = "moon";
	SHAPE_TYPE["NON_ISOSCELES_TRAPEZOID"] = "nonIsoscelesTrapezoid";
	SHAPE_TYPE["NOTCHED_RIGHT_ARROW"] = "notchedRightArrow";
	SHAPE_TYPE["NO_SYMBOL"] = "noSmoking";
	SHAPE_TYPE["OCTAGON"] = "octagon";
	SHAPE_TYPE["OVAL"] = "ellipse";
	SHAPE_TYPE["OVAL_CALLOUT"] = "wedgeEllipseCallout";
	SHAPE_TYPE["PARALLELOGRAM"] = "parallelogram";
	SHAPE_TYPE["PENTAGON"] = "homePlate";
	SHAPE_TYPE["PIE"] = "pie";
	SHAPE_TYPE["PIE_WEDGE"] = "pieWedge";
	SHAPE_TYPE["PLAQUE"] = "plaque";
	SHAPE_TYPE["PLAQUE_TABS"] = "plaqueTabs";
	SHAPE_TYPE["QUAD_ARROW"] = "quadArrow";
	SHAPE_TYPE["QUAD_ARROW_CALLOUT"] = "quadArrowCallout";
	SHAPE_TYPE["RECTANGLE"] = "rect";
	SHAPE_TYPE["RECTANGULAR_CALLOUT"] = "wedgeRectCallout";
	SHAPE_TYPE["REGULAR_PENTAGON"] = "pentagon";
	SHAPE_TYPE["RIGHT_ARROW"] = "rightArrow";
	SHAPE_TYPE["RIGHT_ARROW_CALLOUT"] = "rightArrowCallout";
	SHAPE_TYPE["RIGHT_BRACE"] = "rightBrace";
	SHAPE_TYPE["RIGHT_BRACKET"] = "rightBracket";
	SHAPE_TYPE["RIGHT_TRIANGLE"] = "rtTriangle";
	SHAPE_TYPE["ROUNDED_RECTANGLE"] = "roundRect";
	SHAPE_TYPE["ROUNDED_RECTANGULAR_CALLOUT"] = "wedgeRoundRectCallout";
	SHAPE_TYPE["ROUND_1_RECTANGLE"] = "round1Rect";
	SHAPE_TYPE["ROUND_2_DIAG_RECTANGLE"] = "round2DiagRect";
	SHAPE_TYPE["ROUND_2_SAME_RECTANGLE"] = "round2SameRect";
	SHAPE_TYPE["SMILEY_FACE"] = "smileyFace";
	SHAPE_TYPE["SNIP_1_RECTANGLE"] = "snip1Rect";
	SHAPE_TYPE["SNIP_2_DIAG_RECTANGLE"] = "snip2DiagRect";
	SHAPE_TYPE["SNIP_2_SAME_RECTANGLE"] = "snip2SameRect";
	SHAPE_TYPE["SNIP_ROUND_RECTANGLE"] = "snipRoundRect";
	SHAPE_TYPE["SQUARE_TABS"] = "squareTabs";
	SHAPE_TYPE["STAR_10_POINT"] = "star10";
	SHAPE_TYPE["STAR_12_POINT"] = "star12";
	SHAPE_TYPE["STAR_16_POINT"] = "star16";
	SHAPE_TYPE["STAR_24_POINT"] = "star24";
	SHAPE_TYPE["STAR_32_POINT"] = "star32";
	SHAPE_TYPE["STAR_4_POINT"] = "star4";
	SHAPE_TYPE["STAR_5_POINT"] = "star5";
	SHAPE_TYPE["STAR_6_POINT"] = "star6";
	SHAPE_TYPE["STAR_7_POINT"] = "star7";
	SHAPE_TYPE["STAR_8_POINT"] = "star8";
	SHAPE_TYPE["STRIPED_RIGHT_ARROW"] = "stripedRightArrow";
	SHAPE_TYPE["SUN"] = "sun";
	SHAPE_TYPE["SWOOSH_ARROW"] = "swooshArrow";
	SHAPE_TYPE["TEAR"] = "teardrop";
	SHAPE_TYPE["TRAPEZOID"] = "trapezoid";
	SHAPE_TYPE["UP_ARROW"] = "upArrow";
	SHAPE_TYPE["UP_ARROW_CALLOUT"] = "upArrowCallout";
	SHAPE_TYPE["UP_DOWN_ARROW"] = "upDownArrow";
	SHAPE_TYPE["UP_DOWN_ARROW_CALLOUT"] = "upDownArrowCallout";
	SHAPE_TYPE["UP_RIBBON"] = "ribbon2";
	SHAPE_TYPE["U_TURN_ARROW"] = "uturnArrow";
	SHAPE_TYPE["VERTICAL_SCROLL"] = "verticalScroll";
	SHAPE_TYPE["WAVE"] = "wave";
})(SHAPE_TYPE || (SHAPE_TYPE = {}));
var CHART_TYPE;
(function(CHART_TYPE) {
	CHART_TYPE["AREA"] = "area";
	CHART_TYPE["BAR"] = "bar";
	CHART_TYPE["BAR3D"] = "bar3D";
	CHART_TYPE["BUBBLE"] = "bubble";
	CHART_TYPE["BUBBLE3D"] = "bubble3D";
	CHART_TYPE["DOUGHNUT"] = "doughnut";
	CHART_TYPE["LINE"] = "line";
	CHART_TYPE["PIE"] = "pie";
	CHART_TYPE["RADAR"] = "radar";
	CHART_TYPE["SCATTER"] = "scatter";
})(CHART_TYPE || (CHART_TYPE = {}));
var SCHEME_COLOR_NAMES;
(function(SCHEME_COLOR_NAMES) {
	SCHEME_COLOR_NAMES["TEXT1"] = "tx1";
	SCHEME_COLOR_NAMES["TEXT2"] = "tx2";
	SCHEME_COLOR_NAMES["BACKGROUND1"] = "bg1";
	SCHEME_COLOR_NAMES["BACKGROUND2"] = "bg2";
	SCHEME_COLOR_NAMES["ACCENT1"] = "accent1";
	SCHEME_COLOR_NAMES["ACCENT2"] = "accent2";
	SCHEME_COLOR_NAMES["ACCENT3"] = "accent3";
	SCHEME_COLOR_NAMES["ACCENT4"] = "accent4";
	SCHEME_COLOR_NAMES["ACCENT5"] = "accent5";
	SCHEME_COLOR_NAMES["ACCENT6"] = "accent6";
})(SCHEME_COLOR_NAMES || (SCHEME_COLOR_NAMES = {}));
var MASTER_OBJECTS;
(function(MASTER_OBJECTS) {
	MASTER_OBJECTS["chart"] = "chart";
	MASTER_OBJECTS["image"] = "image";
	MASTER_OBJECTS["line"] = "line";
	MASTER_OBJECTS["rect"] = "rect";
	MASTER_OBJECTS["text"] = "text";
	MASTER_OBJECTS["placeholder"] = "placeholder";
})(MASTER_OBJECTS || (MASTER_OBJECTS = {}));
var SLIDE_OBJECT_TYPES;
(function(SLIDE_OBJECT_TYPES) {
	SLIDE_OBJECT_TYPES["chart"] = "chart";
	SLIDE_OBJECT_TYPES["hyperlink"] = "hyperlink";
	SLIDE_OBJECT_TYPES["image"] = "image";
	SLIDE_OBJECT_TYPES["media"] = "media";
	SLIDE_OBJECT_TYPES["online"] = "online";
	SLIDE_OBJECT_TYPES["placeholder"] = "placeholder";
	SLIDE_OBJECT_TYPES["table"] = "table";
	SLIDE_OBJECT_TYPES["tablecell"] = "tablecell";
	SLIDE_OBJECT_TYPES["text"] = "text";
	SLIDE_OBJECT_TYPES["notes"] = "notes";
})(SLIDE_OBJECT_TYPES || (SLIDE_OBJECT_TYPES = {}));
var PLACEHOLDER_TYPES;
(function(PLACEHOLDER_TYPES) {
	PLACEHOLDER_TYPES["title"] = "title";
	PLACEHOLDER_TYPES["body"] = "body";
	PLACEHOLDER_TYPES["image"] = "pic";
	PLACEHOLDER_TYPES["chart"] = "chart";
	PLACEHOLDER_TYPES["table"] = "tbl";
	PLACEHOLDER_TYPES["media"] = "media";
})(PLACEHOLDER_TYPES || (PLACEHOLDER_TYPES = {}));
/**
* NOTE: 20170304: BULLET_TYPES: Only default is used so far. I'd like to combine the two pieces of code that use these before implementing these as options
* Since we close <p> within the text object bullets, its slightly more difficult than combining into a func and calling to get the paraProp
* and i'm not sure if anyone will even use these... so, skipping for now.
*/
var BULLET_TYPES;
(function(BULLET_TYPES) {
	BULLET_TYPES["DEFAULT"] = "&#x2022;";
	BULLET_TYPES["CHECK"] = "&#x2713;";
	BULLET_TYPES["STAR"] = "&#x2605;";
	BULLET_TYPES["TRIANGLE"] = "&#x25B6;";
})(BULLET_TYPES || (BULLET_TYPES = {}));
//#endregion
//#region src/lib/pptThemes.ts
var F_YAHEI = "Microsoft YaHei";
var F_KAI = "KaiTi, \"楷体\", \"STKaiti\", \"Microsoft YaHei\"";
var GROUP_DECOR = {
	zhongguofeng: {
		decor: "china",
		font: F_KAI
	},
	minimal: {
		decor: "minimal",
		font: F_YAHEI
	},
	academic: {
		decor: "academic",
		font: "\"宋体\", \"SimSun\", \"Microsoft YaHei\""
	},
	fresh: {
		decor: "fresh",
		font: F_YAHEI
	},
	morandi: {
		decor: "fresh",
		font: F_YAHEI
	},
	tech: {
		decor: "tech",
		font: "\"黑体\", \"SimHei\", \"Microsoft YaHei\""
	},
	nature: {
		decor: "fresh",
		font: F_YAHEI
	},
	warm: {
		decor: "warm",
		font: F_KAI
	},
	gradient: {
		decor: "gradient",
		font: F_YAHEI
	},
	special: {
		decor: "special",
		font: F_YAHEI
	}
};
function withDecor(t) {
	const d = GROUP_DECOR[t.groupId] || {
		decor: "minimal",
		font: F_YAHEI
	};
	return {
		...t,
		decor: t.decor ?? d.decor,
		font: t.font ?? d.font
	};
}
var THEMES = [
	{
		id: "zgf-ink-wash",
		name: "水墨丹青",
		group: "中国风",
		groupId: "zhongguofeng",
		primary: "2B2B2B",
		onPrimary: "FFFFFF",
		coverBg: "2B2B2B",
		coverGradient: "linear-gradient(135deg,#2B2B2B,#4A4A4A)",
		lightText: "C9C9C9",
		footer: "9A9A9A",
		body: "333333",
		subtle: "777777",
		bullet: "8A8A8A",
		subjects: [
			"语文",
			"历史",
			"美术",
			"政治"
		],
		grades: ["mid", "high"]
	},
	{
		id: "zgf-guochao",
		name: "国潮新中式",
		group: "中国风",
		groupId: "zhongguofeng",
		primary: "C0392B",
		onPrimary: "FFFFFF",
		coverBg: "C0392B",
		coverGradient: "linear-gradient(135deg,#C0392B,#9E2B25)",
		lightText: "F6D9C0",
		footer: "C97E7E",
		body: "333333",
		subtle: "777777",
		bullet: "D4AF37",
		subjects: [
			"语文",
			"历史",
			"美术"
		],
		grades: ["mid", "high"]
	},
	{
		id: "zgf-classic-red",
		name: "古典朱红",
		group: "中国风",
		groupId: "zhongguofeng",
		primary: "9E2B25",
		onPrimary: "FFF8F0",
		coverBg: "9E2B25",
		lightText: "F2D9C0",
		footer: "C08880",
		body: "3A2A22",
		subtle: "8A7A6A",
		bullet: "C8A06A",
		subjects: ["语文", "历史"],
		grades: ["mid", "high"]
	},
	{
		id: "zgf-shanshui",
		name: "山水青绿",
		group: "中国风",
		groupId: "zhongguofeng",
		primary: "2F6B5E",
		onPrimary: "FFFFFF",
		coverBg: "2F6B5E",
		coverGradient: "linear-gradient(135deg,#2F6B5E,#3E8B77)",
		lightText: "D6E5DC",
		footer: "8FAE9E",
		body: "2E3A33",
		subtle: "7A8A80",
		bullet: "5A9A86",
		subjects: [
			"语文",
			"美术",
			"地理"
		],
		grades: [
			"low",
			"mid",
			"high"
		]
	},
	{
		id: "zgf-song-qing",
		name: "宋韵天青",
		group: "中国风",
		groupId: "zhongguofeng",
		primary: "5B8C9E",
		onPrimary: "FFFFFF",
		coverBg: "5B8C9E",
		lightText: "DCE9EE",
		footer: "9CB6C0",
		body: "33403F",
		subtle: "7E9197",
		bullet: "3F6E7E",
		subjects: [
			"语文",
			"历史",
			"美术"
		],
		grades: ["mid", "high"]
	},
	{
		id: "zgf-zen",
		name: "禅意留白",
		group: "中国风",
		groupId: "zhongguofeng",
		primary: "B08D57",
		onPrimary: "FFFFFF",
		coverBg: "F5F1E8",
		coverGradient: "linear-gradient(135deg,#F5F1E8,#EBE4D4)",
		lightText: "8A8377",
		footer: "A99E8A",
		body: "3A3A3A",
		subtle: "9A9A8A",
		bullet: "B08D57",
		subjects: [
			"语文",
			"美术",
			"政治"
		],
		grades: ["mid", "high"]
	},
	{
		id: "min-classic-blue",
		name: "经典深蓝",
		group: "简约商务",
		groupId: "minimal",
		primary: "1A3A6B",
		onPrimary: "FFFFFF",
		coverBg: "1A3A6B",
		lightText: "CADCFC",
		footer: "8FA8D6",
		body: "333333",
		subtle: "666666",
		bullet: "1A3A6B",
		subjects: [],
		grades: ["mid", "high"]
	},
	{
		id: "min-geo",
		name: "几何极简",
		group: "简约商务",
		groupId: "minimal",
		primary: "2C3E50",
		onPrimary: "FFFFFF",
		coverBg: "2C3E50",
		lightText: "AEBFD0",
		footer: "95A6B8",
		body: "333333",
		subtle: "666666",
		bullet: "2C3E50",
		subjects: ["数学", "信息技术"],
		grades: [
			"low",
			"mid",
			"high"
		]
	},
	{
		id: "min-gray-premium",
		name: "高级灰",
		group: "简约商务",
		groupId: "minimal",
		primary: "4A4A4A",
		onPrimary: "FFFFFF",
		coverBg: "4A4A4A",
		lightText: "CFCFCF",
		footer: "A0A0A0",
		body: "333333",
		subtle: "777777",
		bullet: "4A4A4A",
		subjects: [],
		grades: ["mid", "high"]
	},
	{
		id: "min-pure-white",
		name: "纯净白",
		group: "简约商务",
		groupId: "minimal",
		primary: "1A3A6B",
		onPrimary: "FFFFFF",
		coverBg: "FFFFFF",
		coverGradient: "linear-gradient(135deg,#FFFFFF,#F0F2F7)",
		lightText: "5A6B85",
		footer: "9AA6B8",
		body: "333333",
		subtle: "777777",
		bullet: "1A3A6B",
		subjects: [],
		grades: [
			"low",
			"mid",
			"high"
		]
	},
	{
		id: "min-modern-line",
		name: "现代线条",
		group: "简约商务",
		groupId: "minimal",
		primary: "34495E",
		onPrimary: "FFFFFF",
		coverBg: "34495E",
		lightText: "BFD3E0",
		footer: "9AAEBE",
		body: "333333",
		subtle: "777777",
		bullet: "5DADE2",
		subjects: ["数学"],
		grades: ["mid", "high"]
	},
	{
		id: "min-navy-intellectual",
		name: "知性藏青",
		group: "简约商务",
		groupId: "minimal",
		primary: "14304F",
		onPrimary: "FFFFFF",
		coverBg: "14304F",
		lightText: "C2D6E4",
		footer: "8BA6BE",
		body: "333333",
		subtle: "777777",
		bullet: "6FA8C7",
		subjects: [],
		grades: ["mid", "high"]
	},
	{
		id: "aca-edu-blue",
		name: "教研蓝",
		group: "学术教研",
		groupId: "academic",
		primary: "1F4E79",
		onPrimary: "FFFFFF",
		coverBg: "1F4E79",
		lightText: "C5DBEE",
		footer: "93B0CC",
		body: "333333",
		subtle: "777777",
		bullet: "1F4E79",
		subjects: [],
		grades: [
			"low",
			"mid",
			"high"
		]
	},
	{
		id: "aca-black-gold",
		name: "学术黑金",
		group: "学术教研",
		groupId: "academic",
		primary: "1C1C1C",
		onPrimary: "D4AF37",
		coverBg: "1C1C1C",
		lightText: "C9B98A",
		footer: "B8A878",
		body: "333333",
		subtle: "777777",
		bullet: "D4AF37",
		subjects: [],
		grades: ["high"]
	},
	{
		id: "aca-rational",
		name: "理性灰蓝",
		group: "学术教研",
		groupId: "academic",
		primary: "3B5168",
		onPrimary: "FFFFFF",
		coverBg: "3B5168",
		lightText: "C2D0DC",
		footer: "97A8B8",
		body: "333333",
		subtle: "777777",
		bullet: "5A7C97",
		subjects: ["数学", "化学"],
		grades: ["mid", "high"]
	},
	{
		id: "aca-cream",
		name: "知性米白",
		group: "学术教研",
		groupId: "academic",
		primary: "8C7A5A",
		onPrimary: "FFFFFF",
		coverBg: "F3EEE2",
		lightText: "6A5A3E",
		footer: "B0A080",
		body: "3A3328",
		subtle: "8A8070",
		bullet: "8C7A5A",
		subjects: [],
		grades: ["mid", "high"]
	},
	{
		id: "aca-deep-green",
		name: "沉稳墨绿",
		group: "学术教研",
		groupId: "academic",
		primary: "1E4036",
		onPrimary: "FFFFFF",
		coverBg: "1E4036",
		lightText: "BFD6C9",
		footer: "8AA898",
		body: "333333",
		subtle: "777777",
		bullet: "3E6E58",
		subjects: ["生物", "地理"],
		grades: ["mid", "high"]
	},
	{
		id: "fr-macaron-pink",
		name: "马卡龙粉",
		group: "清新活力",
		groupId: "fresh",
		primary: "F4A6C0",
		onPrimary: "FFFFFF",
		coverBg: "F4A6C0",
		lightText: "FFE3EC",
		footer: "D79FB4",
		body: "5A3A45",
		subtle: "9A7A85",
		bullet: "F1789C",
		subjects: ["美术", "音乐"],
		grades: ["low", "mid"]
	},
	{
		id: "fr-mint",
		name: "薄荷绿",
		group: "清新活力",
		groupId: "fresh",
		primary: "3FA776",
		onPrimary: "FFFFFF",
		coverBg: "6FCF97",
		coverGradient: "linear-gradient(135deg,#6FCF97,#3FA776)",
		lightText: "E6F7EE",
		footer: "86C2A4",
		body: "2E4A3A",
		subtle: "7A8A80",
		bullet: "3FA776",
		subjects: ["生物", "科学"],
		grades: ["low", "mid"]
	},
	{
		id: "fr-sky-blue",
		name: "天蓝童趣",
		group: "清新活力",
		groupId: "fresh",
		primary: "2F8FC4",
		onPrimary: "FFFFFF",
		coverBg: "56B4E9",
		lightText: "EAF6FE",
		footer: "8FC3E0",
		body: "2E3A45",
		subtle: "7A8590",
		bullet: "2F8FC4",
		subjects: ["科学", "英语"],
		grades: ["low", "mid"]
	},
	{
		id: "fr-warm-orange",
		name: "暖橙阳光",
		group: "清新活力",
		groupId: "fresh",
		primary: "D97A2B",
		onPrimary: "FFFFFF",
		coverBg: "F2994A",
		lightText: "FDEBDD",
		footer: "E0A472",
		body: "4A3526",
		subtle: "8A7A6A",
		bullet: "D97A2B",
		subjects: ["体育", "英语"],
		grades: ["low", "mid"]
	},
	{
		id: "fr-lemon",
		name: "柠檬黄",
		group: "清新活力",
		groupId: "fresh",
		primary: "D9A92B",
		onPrimary: "5A4A12",
		coverBg: "F2C94C",
		lightText: "7A6A22",
		footer: "C2B06A",
		body: "4A4220",
		subtle: "8A8060",
		bullet: "D9A92B",
		subjects: ["英语", "美术"],
		grades: ["low", "mid"]
	},
	{
		id: "fr-sakura",
		name: "樱花粉",
		group: "清新活力",
		groupId: "fresh",
		primary: "E89BB4",
		onPrimary: "8A4A5E",
		coverBg: "F8C8D8",
		lightText: "9A5A6E",
		footer: "D9A8BC",
		body: "5A3A45",
		subtle: "9A7A85",
		bullet: "E89BB4",
		subjects: ["美术", "音乐"],
		grades: ["low", "mid"]
	},
	{
		id: "mo-haze-blue",
		name: "雾霾蓝",
		group: "莫兰迪",
		groupId: "morandi",
		primary: "7C93A6",
		onPrimary: "FFFFFF",
		coverBg: "7C93A6",
		lightText: "E2E8ED",
		footer: "AEBECB",
		body: "4A4A4A",
		subtle: "8A8A8A",
		bullet: "5E7689",
		subjects: [],
		grades: ["mid", "high"]
	},
	{
		id: "mo-gray-purple",
		name: "灰紫",
		group: "莫兰迪",
		groupId: "morandi",
		primary: "8A7E95",
		onPrimary: "FFFFFF",
		coverBg: "8A7E95",
		lightText: "E6E1EA",
		footer: "B2A8BC",
		body: "4A4A4A",
		subtle: "8A8A8A",
		bullet: "6E6280",
		subjects: ["美术", "音乐"],
		grades: ["mid", "high"]
	},
	{
		id: "mo-milktea",
		name: "奶茶色",
		group: "莫兰迪",
		groupId: "morandi",
		primary: "B89B82",
		onPrimary: "FFF8F0",
		coverBg: "B89B82",
		lightText: "F3E9DC",
		footer: "D2BCA6",
		body: "4A4238",
		subtle: "8A8070",
		bullet: "9A7E66",
		subjects: [],
		grades: ["mid", "high"]
	},
	{
		id: "mo-bean-green",
		name: "豆沙绿",
		group: "莫兰迪",
		groupId: "morandi",
		primary: "7E8B6E",
		onPrimary: "FFFFFF",
		coverBg: "7E8B6E",
		lightText: "E4E9DD",
		footer: "AAB49C",
		body: "444A3C",
		subtle: "8A8A7A",
		bullet: "62705A",
		subjects: ["生物", "地理"],
		grades: ["mid", "high"]
	},
	{
		id: "mo-rose-gray",
		name: "玫瑰灰",
		group: "莫兰迪",
		groupId: "morandi",
		primary: "A88A8A",
		onPrimary: "FFFFFF",
		coverBg: "A88A8A",
		lightText: "F0E892",
		footer: "C6AEAE",
		body: "4A4444",
		subtle: "8A8A8A",
		bullet: "8C6E6E",
		subjects: ["美术"],
		grades: ["mid", "high"]
	},
	{
		id: "mo-oat",
		name: "燕麦米",
		group: "莫兰迪",
		groupId: "morandi",
		primary: "BBAE92",
		onPrimary: "5A4A33",
		coverBg: "D8C9B0",
		lightText: "6A5A40",
		footer: "CBBE9E",
		body: "4A4233",
		subtle: "8A8068",
		bullet: "BBAE92",
		subjects: [],
		grades: ["mid", "high"]
	},
	{
		id: "te-tech-navy",
		name: "科技深蓝",
		group: "科技未来",
		groupId: "tech",
		primary: "0B2545",
		onPrimary: "4DA8DA",
		coverBg: "0B2545",
		coverGradient: "linear-gradient(135deg,#0B2545,#13315C)",
		lightText: "8FC1E0",
		footer: "6E96BE",
		body: "2B3A4A",
		subtle: "6A7A8A",
		bullet: "4DA8DA",
		subjects: [
			"物理",
			"化学",
			"信息技术"
		],
		grades: ["mid", "high"]
	},
	{
		id: "te-cyber-purple",
		name: "赛博紫",
		group: "科技未来",
		groupId: "tech",
		primary: "2D1B4E",
		onPrimary: "B388FF",
		coverBg: "2D1B4E",
		coverGradient: "linear-gradient(135deg,#2D1B4E,#3B2360)",
		lightText: "C9B6F0",
		footer: "9E86C8",
		body: "332B45",
		subtle: "7A6E8A",
		bullet: "B388FF",
		subjects: ["信息技术", "物理"],
		grades: ["mid", "high"]
	},
	{
		id: "te-aurora-green",
		name: "极光绿",
		group: "科技未来",
		groupId: "tech",
		primary: "0E3B33",
		onPrimary: "4CE0B3",
		coverBg: "0E3B33",
		lightText: "A6EEDD",
		footer: "6EBBA8",
		body: "2B3A36",
		subtle: "6A7A74",
		bullet: "4CE0B3",
		subjects: [
			"生物",
			"化学",
			"信息技术"
		],
		grades: ["mid", "high"]
	},
	{
		id: "te-starry",
		name: "星空黑",
		group: "科技未来",
		groupId: "tech",
		primary: "121212",
		onPrimary: "7FD1FF",
		coverBg: "121212",
		coverGradient: "linear-gradient(135deg,#121212,#1F2937)",
		lightText: "A9C9E0",
		footer: "6E8AA0",
		body: "2B3138",
		subtle: "6A7480",
		bullet: "7FD1FF",
		subjects: [
			"物理",
			"地理",
			"信息技术"
		],
		grades: ["mid", "high"]
	},
	{
		id: "te-quantum-blue",
		name: "量子蓝",
		group: "科技未来",
		groupId: "tech",
		primary: "102A54",
		onPrimary: "5BC0EB",
		coverBg: "102A54",
		lightText: "A6D6EE",
		footer: "6E9CC0",
		body: "2B374A",
		subtle: "6A7488",
		bullet: "5BC0EB",
		subjects: [
			"物理",
			"数学",
			"信息技术"
		],
		grades: ["mid", "high"]
	},
	{
		id: "te-digital-cyan",
		name: "数码青",
		group: "科技未来",
		groupId: "tech",
		primary: "0A3A40",
		onPrimary: "3DD6C4",
		coverBg: "0A3A40",
		lightText: "A0E8DF",
		footer: "6EB8B0",
		body: "2B3A3A",
		subtle: "6A7A78",
		bullet: "3DD6C4",
		subjects: [
			"信息技术",
			"物理",
			"化学"
		],
		grades: ["mid", "high"]
	},
	{
		id: "na-forest",
		name: "森林绿",
		group: "自然生机",
		groupId: "nature",
		primary: "1E5631",
		onPrimary: "FFFFFF",
		coverBg: "1E5631",
		lightText: "C2DCC9",
		footer: "8AAE96",
		body: "2E3A30",
		subtle: "7A8A7C",
		bullet: "3E7A4E",
		subjects: ["生物", "地理"],
		grades: [
			"low",
			"mid",
			"high"
		]
	},
	{
		id: "na-ocean",
		name: "海洋蓝",
		group: "自然生机",
		groupId: "nature",
		primary: "0E5A8A",
		onPrimary: "FFFFFF",
		coverBg: "0E5A8A",
		lightText: "C2DCEF",
		footer: "8AAEC8",
		body: "2E3A45",
		subtle: "7A8A95",
		bullet: "2F8FC4",
		subjects: [
			"生物",
			"地理",
			"科学"
		],
		grades: [
			"low",
			"mid",
			"high"
		]
	},
	{
		id: "na-earth",
		name: "大地棕",
		group: "自然生机",
		groupId: "nature",
		primary: "6B4226",
		onPrimary: "F3E5D0",
		coverBg: "6B4226",
		lightText: "E2CDB0",
		footer: "B08A66",
		body: "3A2E20",
		subtle: "8A7A66",
		bullet: "9C6B47",
		subjects: ["地理", "历史"],
		grades: ["mid", "high"]
	},
	{
		id: "na-dawn",
		name: "晨曦橙",
		group: "自然生机",
		groupId: "nature",
		primary: "C25A18",
		onPrimary: "FFFFFF",
		coverBg: "E8772E",
		coverGradient: "linear-gradient(135deg,#E8772E,#C25A18)",
		lightText: "FDEBDD",
		footer: "E0A472",
		body: "4A3526",
		subtle: "8A7A66",
		bullet: "C25A18",
		subjects: ["体育", "科学"],
		grades: ["low", "mid"]
	},
	{
		id: "na-grass",
		name: "草木青",
		group: "自然生机",
		groupId: "nature",
		primary: "5A8A3C",
		onPrimary: "FFFFFF",
		coverBg: "5A8A3C",
		lightText: "E2EED6",
		footer: "9AB87E",
		body: "2E3A2C",
		subtle: "7A8A74",
		bullet: "7FB14E",
		subjects: ["生物", "科学"],
		grades: [
			"low",
			"mid",
			"high"
		]
	},
	{
		id: "wa-elegant-purple",
		name: "典雅紫",
		group: "典雅暖调",
		groupId: "warm",
		primary: "5B3A78",
		onPrimary: "FFFFFF",
		coverBg: "5B3A78",
		lightText: "D9C9E8",
		footer: "A98CC0",
		body: "3A2E45",
		subtle: "7A6E8A",
		bullet: "8E6CB0",
		subjects: [
			"美术",
			"音乐",
			"语文"
		],
		grades: ["mid", "high"]
	},
	{
		id: "wa-wine",
		name: "酒红",
		group: "典雅暖调",
		groupId: "warm",
		primary: "6E1F2A",
		onPrimary: "F3D9C0",
		coverBg: "6E1F2A",
		lightText: "E2C2BC",
		footer: "B07A78",
		body: "3A2622",
		subtle: "8A6E6A",
		bullet: "A85762",
		subjects: ["语文", "历史"],
		grades: ["high"]
	},
	{
		id: "wa-caramel",
		name: "焦糖棕",
		group: "典雅暖调",
		groupId: "warm",
		primary: "8A5A2B",
		onPrimary: "FFF3E0",
		coverBg: "8A5A2B",
		lightText: "E6CDB0",
		footer: "C09A66",
		body: "3A2E20",
		subtle: "8A7A66",
		bullet: "B07A45",
		subjects: ["美术", "历史"],
		grades: ["mid", "high"]
	},
	{
		id: "wa-rosegold",
		name: "玫瑰金",
		group: "典雅暖调",
		groupId: "warm",
		primary: "B76E79",
		onPrimary: "FFF8F0",
		coverBg: "B76E79",
		lightText: "F3D9DE",
		footer: "D6A0A8",
		body: "4A383C",
		subtle: "8A7A7A",
		bullet: "D69AA0",
		subjects: ["美术", "音乐"],
		grades: ["mid", "high"]
	},
	{
		id: "wa-warm-peach",
		name: "暖橘粉",
		group: "典雅暖调",
		groupId: "warm",
		primary: "E08A6B",
		onPrimary: "FFFFFF",
		coverBg: "E08A6B",
		lightText: "FCE4DB",
		footer: "E0A98A",
		body: "4A342E",
		subtle: "8A746A",
		bullet: "C56A4B",
		subjects: [
			"美术",
			"音乐",
			"英语"
		],
		grades: [
			"low",
			"mid",
			"high"
		]
	},
	{
		id: "gr-blue-purple",
		name: "蓝紫渐变",
		group: "渐变现代",
		groupId: "gradient",
		primary: "3B49C9",
		onPrimary: "FFFFFF",
		coverBg: "3B49C9",
		coverGradient: "linear-gradient(135deg,#3B49C9,#8E44EC)",
		lightText: "E0E2FB",
		footer: "9A9EF0",
		body: "33333F",
		subtle: "777787",
		bullet: "8E44EC",
		subjects: ["信息技术", "美术"],
		grades: ["mid", "high"]
	},
	{
		id: "gr-orange-pink",
		name: "橙粉渐变",
		group: "渐变现代",
		groupId: "gradient",
		primary: "FF6B6B",
		onPrimary: "FFFFFF",
		coverBg: "FF6B6B",
		coverGradient: "linear-gradient(135deg,#FF8A5B,#FF5C8A)",
		lightText: "FFE6EC",
		footer: "FFA0AE",
		body: "4A3036",
		subtle: "8A7A80",
		bullet: "FF5C8A",
		subjects: ["美术", "音乐"],
		grades: [
			"low",
			"mid",
			"high"
		]
	},
	{
		id: "gr-cyan-green",
		name: "青绿渐变",
		group: "渐变现代",
		groupId: "gradient",
		primary: "12B8A6",
		onPrimary: "FFFFFF",
		coverBg: "12B8A6",
		coverGradient: "linear-gradient(135deg,#12B8A6,#3FA776)",
		lightText: "E0F7F2",
		footer: "8AD0C4",
		body: "2E3A36",
		subtle: "7A8A80",
		bullet: "3FA776",
		subjects: ["生物", "科学"],
		grades: [
			"low",
			"mid",
			"high"
		]
	},
	{
		id: "gr-purple-pink",
		name: "紫粉渐变",
		group: "渐变现代",
		groupId: "gradient",
		primary: "8E44EC",
		onPrimary: "FFFFFF",
		coverBg: "8E44EC",
		coverGradient: "linear-gradient(135deg,#8E44EC,#8E44EC)",
		lightText: "F2E2F8",
		footer: "C79AE0",
		body: "3A2E45",
		subtle: "7A6E8A",
		bullet: "E85FB0",
		subjects: ["美术", "音乐"],
		grades: ["low", "mid"]
	},
	{
		id: "gr-gold-orange",
		name: "金橙渐变",
		group: "渐变现代",
		groupId: "gradient",
		primary: "F2994A",
		onPrimary: "FFFFFF",
		coverBg: "F2C94C",
		coverGradient: "linear-gradient(135deg,#F2C94C,#F2994A)",
		lightText: "5A4A12",
		footer: "E0B072",
		body: "4A3E22",
		subtle: "8A8060",
		bullet: "F2994A",
		subjects: ["美术", "体育"],
		grades: [
			"low",
			"mid",
			"high"
		]
	},
	{
		id: "gr-aurora",
		name: "极光渐变",
		group: "渐变现代",
		groupId: "gradient",
		primary: "2D9CDB",
		onPrimary: "FFFFFF",
		coverBg: "2D9CDB",
		coverGradient: "linear-gradient(135deg,#2D9CDB,#9B51E0,#4CE0B3)",
		lightText: "E2F2FB",
		footer: "9AB8E0",
		body: "2E3A45",
		subtle: "7A8A95",
		bullet: "9B51E0",
		subjects: ["信息技术", "物理"],
		grades: ["mid", "high"]
	},
	{
		id: "sp-party-red",
		name: "党政红",
		group: "专项主题",
		groupId: "special",
		primary: "C0271E",
		onPrimary: "FFFFFF",
		coverBg: "C0271E",
		lightText: "F5D2CE",
		footer: "E09A92",
		body: "333333",
		subtle: "777777",
		bullet: "F2C94C",
		subjects: ["政治"],
		grades: ["mid", "high"]
	},
	{
		id: "sp-festive",
		name: "节日红金",
		group: "专项主题",
		groupId: "special",
		primary: "B5121B",
		onPrimary: "FFE9A8",
		coverBg: "B5121B",
		coverGradient: "linear-gradient(135deg,#B5121B,#8A0E16)",
		lightText: "F5E2AC",
		footer: "D9A878",
		body: "4A2A22",
		subtle: "8A6A5A",
		bullet: "D4AF37",
		subjects: [
			"语文",
			"政治",
			"英语"
		],
		grades: [
			"low",
			"mid",
			"high"
		]
	},
	{
		id: "sp-cartoon",
		name: "卡通插画",
		group: "专项主题",
		groupId: "special",
		primary: "4FB0E5",
		onPrimary: "FFFFFF",
		coverBg: "4FB0E5",
		coverGradient: "linear-gradient(135deg,#4FB0E5,#5FD0C0)",
		lightText: "EAF7FE",
		footer: "9CCDE8",
		body: "2E3A45",
		subtle: "7A8A95",
		bullet: "FF9F43",
		subjects: [
			"英语",
			"美术",
			"音乐"
		],
		grades: ["low", "mid"]
	},
	{
		id: "sp-chalkboard",
		name: "黑板粉笔",
		group: "专项主题",
		groupId: "special",
		primary: "1B2A1B",
		onPrimary: "F5F5F0",
		coverBg: "1B2A1B",
		coverGradient: "linear-gradient(135deg,#1B2A1B,#26331F)",
		lightText: "D8E0D0",
		footer: "9AB08A",
		body: "2E3A2E",
		subtle: "6A7A6A",
		bullet: "FFE08A",
		subjects: [
			"数学",
			"物理",
			"化学",
			"英语"
		],
		grades: [
			"low",
			"mid",
			"high"
		]
	},
	{
		id: "sp-doodle",
		name: "手绘涂鸦",
		group: "专项主题",
		groupId: "special",
		primary: "F4C430",
		onPrimary: "3A3A3A",
		coverBg: "FFD166",
		coverGradient: "linear-gradient(135deg,#FFD166,#FFB85C)",
		lightText: "5A4A12",
		footer: "D9B050",
		body: "3A3A3A",
		subtle: "8A8A6A",
		bullet: "EF476F",
		subjects: ["美术", "英语"],
		grades: ["low", "mid"]
	}
].map(withDecor);
var DEFAULT_THEME = THEMES.find((t) => t.id === "min-classic-blue");
var _byId = new Map(THEMES.map((t) => [t.id, t]));
function getTheme(id) {
	if (!id) return DEFAULT_THEME;
	return _byId.get(id) || DEFAULT_THEME;
}
(() => {
	const order = [];
	const map = /* @__PURE__ */ new Map();
	for (const t of THEMES) {
		if (!map.has(t.groupId)) {
			map.set(t.groupId, {
				id: t.groupId,
				name: t.group,
				themes: []
			});
			order.push(t.groupId);
		}
		map.get(t.groupId).themes.push(t);
	}
	return order.map((id) => map.get(id));
})();
DEFAULT_THEME.id;
//#endregion
//#region node_modules/react/cjs/react.production.js
/**
* @license React
* react.production.js
*
* Copyright (c) Meta Platforms, Inc. and affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
var require_react_production = /* @__PURE__ */ __commonJSMin(((exports) => {
	var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = Symbol.for("react.activity"), MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
	function getIteratorFn(maybeIterable) {
		if (null === maybeIterable || "object" !== typeof maybeIterable) return null;
		maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
		return "function" === typeof maybeIterable ? maybeIterable : null;
	}
	var ReactNoopUpdateQueue = {
		isMounted: function() {
			return !1;
		},
		enqueueForceUpdate: function() {},
		enqueueReplaceState: function() {},
		enqueueSetState: function() {}
	}, assign = Object.assign, emptyObject = {};
	function Component(props, context, updater) {
		this.props = props;
		this.context = context;
		this.refs = emptyObject;
		this.updater = updater || ReactNoopUpdateQueue;
	}
	Component.prototype.isReactComponent = {};
	Component.prototype.setState = function(partialState, callback) {
		if ("object" !== typeof partialState && "function" !== typeof partialState && null != partialState) throw Error("takes an object of state variables to update or a function which returns an object of state variables.");
		this.updater.enqueueSetState(this, partialState, callback, "setState");
	};
	Component.prototype.forceUpdate = function(callback) {
		this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
	};
	function ComponentDummy() {}
	ComponentDummy.prototype = Component.prototype;
	function PureComponent(props, context, updater) {
		this.props = props;
		this.context = context;
		this.refs = emptyObject;
		this.updater = updater || ReactNoopUpdateQueue;
	}
	var pureComponentPrototype = PureComponent.prototype = new ComponentDummy();
	pureComponentPrototype.constructor = PureComponent;
	assign(pureComponentPrototype, Component.prototype);
	pureComponentPrototype.isPureReactComponent = !0;
	var isArrayImpl = Array.isArray;
	function noop() {}
	var ReactSharedInternals = {
		H: null,
		A: null,
		T: null,
		S: null
	}, hasOwnProperty = Object.prototype.hasOwnProperty;
	function ReactElement(type, key, props) {
		var refProp = props.ref;
		return {
			$$typeof: REACT_ELEMENT_TYPE,
			type,
			key,
			ref: void 0 !== refProp ? refProp : null,
			props
		};
	}
	function cloneAndReplaceKey(oldElement, newKey) {
		return ReactElement(oldElement.type, newKey, oldElement.props);
	}
	function isValidElement(object) {
		return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
	}
	function escape(key) {
		var escaperLookup = {
			"=": "=0",
			":": "=2"
		};
		return "$" + key.replace(/[=:]/g, function(match) {
			return escaperLookup[match];
		});
	}
	var userProvidedKeyEscapeRegex = /\/+/g;
	function getElementKey(element, index) {
		return "object" === typeof element && null !== element && null != element.key ? escape("" + element.key) : index.toString(36);
	}
	function resolveThenable(thenable) {
		switch (thenable.status) {
			case "fulfilled": return thenable.value;
			case "rejected": throw thenable.reason;
			default: switch ("string" === typeof thenable.status ? thenable.then(noop, noop) : (thenable.status = "pending", thenable.then(function(fulfilledValue) {
				"pending" === thenable.status && (thenable.status = "fulfilled", thenable.value = fulfilledValue);
			}, function(error) {
				"pending" === thenable.status && (thenable.status = "rejected", thenable.reason = error);
			})), thenable.status) {
				case "fulfilled": return thenable.value;
				case "rejected": throw thenable.reason;
			}
		}
		throw thenable;
	}
	function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
		var type = typeof children;
		if ("undefined" === type || "boolean" === type) children = null;
		var invokeCallback = !1;
		if (null === children) invokeCallback = !0;
		else switch (type) {
			case "bigint":
			case "string":
			case "number":
				invokeCallback = !0;
				break;
			case "object": switch (children.$$typeof) {
				case REACT_ELEMENT_TYPE:
				case REACT_PORTAL_TYPE:
					invokeCallback = !0;
					break;
				case REACT_LAZY_TYPE: return invokeCallback = children._init, mapIntoArray(invokeCallback(children._payload), array, escapedPrefix, nameSoFar, callback);
			}
		}
		if (invokeCallback) return callback = callback(children), invokeCallback = "" === nameSoFar ? "." + getElementKey(children, 0) : nameSoFar, isArrayImpl(callback) ? (escapedPrefix = "", null != invokeCallback && (escapedPrefix = invokeCallback.replace(userProvidedKeyEscapeRegex, "$&/") + "/"), mapIntoArray(callback, array, escapedPrefix, "", function(c) {
			return c;
		})) : null != callback && (isValidElement(callback) && (callback = cloneAndReplaceKey(callback, escapedPrefix + (null == callback.key || children && children.key === callback.key ? "" : ("" + callback.key).replace(userProvidedKeyEscapeRegex, "$&/") + "/") + invokeCallback)), array.push(callback)), 1;
		invokeCallback = 0;
		var nextNamePrefix = "" === nameSoFar ? "." : nameSoFar + ":";
		if (isArrayImpl(children)) for (var i = 0; i < children.length; i++) nameSoFar = children[i], type = nextNamePrefix + getElementKey(nameSoFar, i), invokeCallback += mapIntoArray(nameSoFar, array, escapedPrefix, type, callback);
		else if (i = getIteratorFn(children), "function" === typeof i) for (children = i.call(children), i = 0; !(nameSoFar = children.next()).done;) nameSoFar = nameSoFar.value, type = nextNamePrefix + getElementKey(nameSoFar, i++), invokeCallback += mapIntoArray(nameSoFar, array, escapedPrefix, type, callback);
		else if ("object" === type) {
			if ("function" === typeof children.then) return mapIntoArray(resolveThenable(children), array, escapedPrefix, nameSoFar, callback);
			array = String(children);
			throw Error("Objects are not valid as a React child (found: " + ("[object Object]" === array ? "object with keys {" + Object.keys(children).join(", ") + "}" : array) + "). If you meant to render a collection of children, use an array instead.");
		}
		return invokeCallback;
	}
	function mapChildren(children, func, context) {
		if (null == children) return children;
		var result = [], count = 0;
		mapIntoArray(children, result, "", "", function(child) {
			return func.call(context, child, count++);
		});
		return result;
	}
	function lazyInitializer(payload) {
		if (-1 === payload._status) {
			var ctor = payload._result;
			ctor = ctor();
			ctor.then(function(moduleObject) {
				if (0 === payload._status || -1 === payload._status) payload._status = 1, payload._result = moduleObject;
			}, function(error) {
				if (0 === payload._status || -1 === payload._status) payload._status = 2, payload._result = error;
			});
			-1 === payload._status && (payload._status = 0, payload._result = ctor);
		}
		if (1 === payload._status) return payload._result.default;
		throw payload._result;
	}
	var reportGlobalError = "function" === typeof reportError ? reportError : function(error) {
		if ("object" === typeof window && "function" === typeof window.ErrorEvent) {
			var event = new window.ErrorEvent("error", {
				bubbles: !0,
				cancelable: !0,
				message: "object" === typeof error && null !== error && "string" === typeof error.message ? String(error.message) : String(error),
				error
			});
			if (!window.dispatchEvent(event)) return;
		} else if ("object" === typeof process && "function" === typeof process.emit) {
			process.emit("uncaughtException", error);
			return;
		}
		console.error(error);
	}, Children = {
		map: mapChildren,
		forEach: function(children, forEachFunc, forEachContext) {
			mapChildren(children, function() {
				forEachFunc.apply(this, arguments);
			}, forEachContext);
		},
		count: function(children) {
			var n = 0;
			mapChildren(children, function() {
				n++;
			});
			return n;
		},
		toArray: function(children) {
			return mapChildren(children, function(child) {
				return child;
			}) || [];
		},
		only: function(children) {
			if (!isValidElement(children)) throw Error("React.Children.only expected to receive a single React element child.");
			return children;
		}
	};
	exports.Activity = REACT_ACTIVITY_TYPE;
	exports.Children = Children;
	exports.Component = Component;
	exports.Fragment = REACT_FRAGMENT_TYPE;
	exports.Profiler = REACT_PROFILER_TYPE;
	exports.PureComponent = PureComponent;
	exports.StrictMode = REACT_STRICT_MODE_TYPE;
	exports.Suspense = REACT_SUSPENSE_TYPE;
	exports.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = ReactSharedInternals;
	exports.__COMPILER_RUNTIME = {
		__proto__: null,
		c: function(size) {
			return ReactSharedInternals.H.useMemoCache(size);
		}
	};
	exports.cache = function(fn) {
		return function() {
			return fn.apply(null, arguments);
		};
	};
	exports.cacheSignal = function() {
		return null;
	};
	exports.cloneElement = function(element, config, children) {
		if (null === element || void 0 === element) throw Error("The argument must be a React element, but you passed " + element + ".");
		var props = assign({}, element.props), key = element.key;
		if (null != config) for (propName in void 0 !== config.key && (key = "" + config.key), config) !hasOwnProperty.call(config, propName) || "key" === propName || "__self" === propName || "__source" === propName || "ref" === propName && void 0 === config.ref || (props[propName] = config[propName]);
		var propName = arguments.length - 2;
		if (1 === propName) props.children = children;
		else if (1 < propName) {
			for (var childArray = Array(propName), i = 0; i < propName; i++) childArray[i] = arguments[i + 2];
			props.children = childArray;
		}
		return ReactElement(element.type, key, props);
	};
	exports.createContext = function(defaultValue) {
		defaultValue = {
			$$typeof: REACT_CONTEXT_TYPE,
			_currentValue: defaultValue,
			_currentValue2: defaultValue,
			_threadCount: 0,
			Provider: null,
			Consumer: null
		};
		defaultValue.Provider = defaultValue;
		defaultValue.Consumer = {
			$$typeof: REACT_CONSUMER_TYPE,
			_context: defaultValue
		};
		return defaultValue;
	};
	exports.createElement = function(type, config, children) {
		var propName, props = {}, key = null;
		if (null != config) for (propName in void 0 !== config.key && (key = "" + config.key), config) hasOwnProperty.call(config, propName) && "key" !== propName && "__self" !== propName && "__source" !== propName && (props[propName] = config[propName]);
		var childrenLength = arguments.length - 2;
		if (1 === childrenLength) props.children = children;
		else if (1 < childrenLength) {
			for (var childArray = Array(childrenLength), i = 0; i < childrenLength; i++) childArray[i] = arguments[i + 2];
			props.children = childArray;
		}
		if (type && type.defaultProps) for (propName in childrenLength = type.defaultProps, childrenLength) void 0 === props[propName] && (props[propName] = childrenLength[propName]);
		return ReactElement(type, key, props);
	};
	exports.createRef = function() {
		return { current: null };
	};
	exports.forwardRef = function(render) {
		return {
			$$typeof: REACT_FORWARD_REF_TYPE,
			render
		};
	};
	exports.isValidElement = isValidElement;
	exports.lazy = function(ctor) {
		return {
			$$typeof: REACT_LAZY_TYPE,
			_payload: {
				_status: -1,
				_result: ctor
			},
			_init: lazyInitializer
		};
	};
	exports.memo = function(type, compare) {
		return {
			$$typeof: REACT_MEMO_TYPE,
			type,
			compare: void 0 === compare ? null : compare
		};
	};
	exports.startTransition = function(scope) {
		var prevTransition = ReactSharedInternals.T, currentTransition = {};
		ReactSharedInternals.T = currentTransition;
		try {
			var returnValue = scope(), onStartTransitionFinish = ReactSharedInternals.S;
			null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
			"object" === typeof returnValue && null !== returnValue && "function" === typeof returnValue.then && returnValue.then(noop, reportGlobalError);
		} catch (error) {
			reportGlobalError(error);
		} finally {
			null !== prevTransition && null !== currentTransition.types && (prevTransition.types = currentTransition.types), ReactSharedInternals.T = prevTransition;
		}
	};
	exports.unstable_useCacheRefresh = function() {
		return ReactSharedInternals.H.useCacheRefresh();
	};
	exports.use = function(usable) {
		return ReactSharedInternals.H.use(usable);
	};
	exports.useActionState = function(action, initialState, permalink) {
		return ReactSharedInternals.H.useActionState(action, initialState, permalink);
	};
	exports.useCallback = function(callback, deps) {
		return ReactSharedInternals.H.useCallback(callback, deps);
	};
	exports.useContext = function(Context) {
		return ReactSharedInternals.H.useContext(Context);
	};
	exports.useDebugValue = function() {};
	exports.useDeferredValue = function(value, initialValue) {
		return ReactSharedInternals.H.useDeferredValue(value, initialValue);
	};
	exports.useEffect = function(create, deps) {
		return ReactSharedInternals.H.useEffect(create, deps);
	};
	exports.useEffectEvent = function(callback) {
		return ReactSharedInternals.H.useEffectEvent(callback);
	};
	exports.useId = function() {
		return ReactSharedInternals.H.useId();
	};
	exports.useImperativeHandle = function(ref, create, deps) {
		return ReactSharedInternals.H.useImperativeHandle(ref, create, deps);
	};
	exports.useInsertionEffect = function(create, deps) {
		return ReactSharedInternals.H.useInsertionEffect(create, deps);
	};
	exports.useLayoutEffect = function(create, deps) {
		return ReactSharedInternals.H.useLayoutEffect(create, deps);
	};
	exports.useMemo = function(create, deps) {
		return ReactSharedInternals.H.useMemo(create, deps);
	};
	exports.useOptimistic = function(passthrough, reducer) {
		return ReactSharedInternals.H.useOptimistic(passthrough, reducer);
	};
	exports.useReducer = function(reducer, initialArg, init) {
		return ReactSharedInternals.H.useReducer(reducer, initialArg, init);
	};
	exports.useRef = function(initialValue) {
		return ReactSharedInternals.H.useRef(initialValue);
	};
	exports.useState = function(initialState) {
		return ReactSharedInternals.H.useState(initialState);
	};
	exports.useSyncExternalStore = function(subscribe, getSnapshot, getServerSnapshot) {
		return ReactSharedInternals.H.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
	};
	exports.useTransition = function() {
		return ReactSharedInternals.H.useTransition();
	};
	exports.version = "19.2.7";
}));
//#endregion
//#region node_modules/react/cjs/react.development.js
/**
* @license React
* react.development.js
*
* Copyright (c) Meta Platforms, Inc. and affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
var require_react_development = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	"production" !== process.env.NODE_ENV && (function() {
		function defineDeprecationWarning(methodName, info) {
			Object.defineProperty(Component.prototype, methodName, { get: function() {
				console.warn("%s(...) is deprecated in plain JavaScript React classes. %s", info[0], info[1]);
			} });
		}
		function getIteratorFn(maybeIterable) {
			if (null === maybeIterable || "object" !== typeof maybeIterable) return null;
			maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
			return "function" === typeof maybeIterable ? maybeIterable : null;
		}
		function warnNoop(publicInstance, callerName) {
			publicInstance = (publicInstance = publicInstance.constructor) && (publicInstance.displayName || publicInstance.name) || "ReactClass";
			var warningKey = publicInstance + "." + callerName;
			didWarnStateUpdateForUnmountedComponent[warningKey] || (console.error("Can't call %s on a component that is not yet mounted. This is a no-op, but it might indicate a bug in your application. Instead, assign to `this.state` directly or define a `state = {};` class property with the desired state in the %s component.", callerName, publicInstance), didWarnStateUpdateForUnmountedComponent[warningKey] = !0);
		}
		function Component(props, context, updater) {
			this.props = props;
			this.context = context;
			this.refs = emptyObject;
			this.updater = updater || ReactNoopUpdateQueue;
		}
		function ComponentDummy() {}
		function PureComponent(props, context, updater) {
			this.props = props;
			this.context = context;
			this.refs = emptyObject;
			this.updater = updater || ReactNoopUpdateQueue;
		}
		function noop() {}
		function testStringCoercion(value) {
			return "" + value;
		}
		function checkKeyStringCoercion(value) {
			try {
				testStringCoercion(value);
				var JSCompiler_inline_result = !1;
			} catch (e) {
				JSCompiler_inline_result = !0;
			}
			if (JSCompiler_inline_result) {
				JSCompiler_inline_result = console;
				var JSCompiler_temp_const = JSCompiler_inline_result.error;
				var JSCompiler_inline_result$jscomp$0 = "function" === typeof Symbol && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
				JSCompiler_temp_const.call(JSCompiler_inline_result, "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.", JSCompiler_inline_result$jscomp$0);
				return testStringCoercion(value);
			}
		}
		function getComponentNameFromType(type) {
			if (null == type) return null;
			if ("function" === typeof type) return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
			if ("string" === typeof type) return type;
			switch (type) {
				case REACT_FRAGMENT_TYPE: return "Fragment";
				case REACT_PROFILER_TYPE: return "Profiler";
				case REACT_STRICT_MODE_TYPE: return "StrictMode";
				case REACT_SUSPENSE_TYPE: return "Suspense";
				case REACT_SUSPENSE_LIST_TYPE: return "SuspenseList";
				case REACT_ACTIVITY_TYPE: return "Activity";
			}
			if ("object" === typeof type) switch ("number" === typeof type.tag && console.error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."), type.$$typeof) {
				case REACT_PORTAL_TYPE: return "Portal";
				case REACT_CONTEXT_TYPE: return type.displayName || "Context";
				case REACT_CONSUMER_TYPE: return (type._context.displayName || "Context") + ".Consumer";
				case REACT_FORWARD_REF_TYPE:
					var innerType = type.render;
					type = type.displayName;
					type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
					return type;
				case REACT_MEMO_TYPE: return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
				case REACT_LAZY_TYPE:
					innerType = type._payload;
					type = type._init;
					try {
						return getComponentNameFromType(type(innerType));
					} catch (x) {}
			}
			return null;
		}
		function getTaskName(type) {
			if (type === REACT_FRAGMENT_TYPE) return "<>";
			if ("object" === typeof type && null !== type && type.$$typeof === REACT_LAZY_TYPE) return "<...>";
			try {
				var name = getComponentNameFromType(type);
				return name ? "<" + name + ">" : "<...>";
			} catch (x) {
				return "<...>";
			}
		}
		function getOwner() {
			var dispatcher = ReactSharedInternals.A;
			return null === dispatcher ? null : dispatcher.getOwner();
		}
		function UnknownOwner() {
			return Error("react-stack-top-frame");
		}
		function hasValidKey(config) {
			if (hasOwnProperty.call(config, "key")) {
				var getter = Object.getOwnPropertyDescriptor(config, "key").get;
				if (getter && getter.isReactWarning) return !1;
			}
			return void 0 !== config.key;
		}
		function defineKeyPropWarningGetter(props, displayName) {
			function warnAboutAccessingKey() {
				specialPropKeyWarningShown || (specialPropKeyWarningShown = !0, console.error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)", displayName));
			}
			warnAboutAccessingKey.isReactWarning = !0;
			Object.defineProperty(props, "key", {
				get: warnAboutAccessingKey,
				configurable: !0
			});
		}
		function elementRefGetterWithDeprecationWarning() {
			var componentName = getComponentNameFromType(this.type);
			didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = !0, console.error("Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."));
			componentName = this.props.ref;
			return void 0 !== componentName ? componentName : null;
		}
		function ReactElement(type, key, props, owner, debugStack, debugTask) {
			var refProp = props.ref;
			type = {
				$$typeof: REACT_ELEMENT_TYPE,
				type,
				key,
				props,
				_owner: owner
			};
			null !== (void 0 !== refProp ? refProp : null) ? Object.defineProperty(type, "ref", {
				enumerable: !1,
				get: elementRefGetterWithDeprecationWarning
			}) : Object.defineProperty(type, "ref", {
				enumerable: !1,
				value: null
			});
			type._store = {};
			Object.defineProperty(type._store, "validated", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: 0
			});
			Object.defineProperty(type, "_debugInfo", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: null
			});
			Object.defineProperty(type, "_debugStack", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: debugStack
			});
			Object.defineProperty(type, "_debugTask", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: debugTask
			});
			Object.freeze && (Object.freeze(type.props), Object.freeze(type));
			return type;
		}
		function cloneAndReplaceKey(oldElement, newKey) {
			newKey = ReactElement(oldElement.type, newKey, oldElement.props, oldElement._owner, oldElement._debugStack, oldElement._debugTask);
			oldElement._store && (newKey._store.validated = oldElement._store.validated);
			return newKey;
		}
		function validateChildKeys(node) {
			isValidElement(node) ? node._store && (node._store.validated = 1) : "object" === typeof node && null !== node && node.$$typeof === REACT_LAZY_TYPE && ("fulfilled" === node._payload.status ? isValidElement(node._payload.value) && node._payload.value._store && (node._payload.value._store.validated = 1) : node._store && (node._store.validated = 1));
		}
		function isValidElement(object) {
			return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
		}
		function escape(key) {
			var escaperLookup = {
				"=": "=0",
				":": "=2"
			};
			return "$" + key.replace(/[=:]/g, function(match) {
				return escaperLookup[match];
			});
		}
		function getElementKey(element, index) {
			return "object" === typeof element && null !== element && null != element.key ? (checkKeyStringCoercion(element.key), escape("" + element.key)) : index.toString(36);
		}
		function resolveThenable(thenable) {
			switch (thenable.status) {
				case "fulfilled": return thenable.value;
				case "rejected": throw thenable.reason;
				default: switch ("string" === typeof thenable.status ? thenable.then(noop, noop) : (thenable.status = "pending", thenable.then(function(fulfilledValue) {
					"pending" === thenable.status && (thenable.status = "fulfilled", thenable.value = fulfilledValue);
				}, function(error) {
					"pending" === thenable.status && (thenable.status = "rejected", thenable.reason = error);
				})), thenable.status) {
					case "fulfilled": return thenable.value;
					case "rejected": throw thenable.reason;
				}
			}
			throw thenable;
		}
		function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
			var type = typeof children;
			if ("undefined" === type || "boolean" === type) children = null;
			var invokeCallback = !1;
			if (null === children) invokeCallback = !0;
			else switch (type) {
				case "bigint":
				case "string":
				case "number":
					invokeCallback = !0;
					break;
				case "object": switch (children.$$typeof) {
					case REACT_ELEMENT_TYPE:
					case REACT_PORTAL_TYPE:
						invokeCallback = !0;
						break;
					case REACT_LAZY_TYPE: return invokeCallback = children._init, mapIntoArray(invokeCallback(children._payload), array, escapedPrefix, nameSoFar, callback);
				}
			}
			if (invokeCallback) {
				invokeCallback = children;
				callback = callback(invokeCallback);
				var childKey = "" === nameSoFar ? "." + getElementKey(invokeCallback, 0) : nameSoFar;
				isArrayImpl(callback) ? (escapedPrefix = "", null != childKey && (escapedPrefix = childKey.replace(userProvidedKeyEscapeRegex, "$&/") + "/"), mapIntoArray(callback, array, escapedPrefix, "", function(c) {
					return c;
				})) : null != callback && (isValidElement(callback) && (null != callback.key && (invokeCallback && invokeCallback.key === callback.key || checkKeyStringCoercion(callback.key)), escapedPrefix = cloneAndReplaceKey(callback, escapedPrefix + (null == callback.key || invokeCallback && invokeCallback.key === callback.key ? "" : ("" + callback.key).replace(userProvidedKeyEscapeRegex, "$&/") + "/") + childKey), "" !== nameSoFar && null != invokeCallback && isValidElement(invokeCallback) && null == invokeCallback.key && invokeCallback._store && !invokeCallback._store.validated && (escapedPrefix._store.validated = 2), callback = escapedPrefix), array.push(callback));
				return 1;
			}
			invokeCallback = 0;
			childKey = "" === nameSoFar ? "." : nameSoFar + ":";
			if (isArrayImpl(children)) for (var i = 0; i < children.length; i++) nameSoFar = children[i], type = childKey + getElementKey(nameSoFar, i), invokeCallback += mapIntoArray(nameSoFar, array, escapedPrefix, type, callback);
			else if (i = getIteratorFn(children), "function" === typeof i) for (i === children.entries && (didWarnAboutMaps || console.warn("Using Maps as children is not supported. Use an array of keyed ReactElements instead."), didWarnAboutMaps = !0), children = i.call(children), i = 0; !(nameSoFar = children.next()).done;) nameSoFar = nameSoFar.value, type = childKey + getElementKey(nameSoFar, i++), invokeCallback += mapIntoArray(nameSoFar, array, escapedPrefix, type, callback);
			else if ("object" === type) {
				if ("function" === typeof children.then) return mapIntoArray(resolveThenable(children), array, escapedPrefix, nameSoFar, callback);
				array = String(children);
				throw Error("Objects are not valid as a React child (found: " + ("[object Object]" === array ? "object with keys {" + Object.keys(children).join(", ") + "}" : array) + "). If you meant to render a collection of children, use an array instead.");
			}
			return invokeCallback;
		}
		function mapChildren(children, func, context) {
			if (null == children) return children;
			var result = [], count = 0;
			mapIntoArray(children, result, "", "", function(child) {
				return func.call(context, child, count++);
			});
			return result;
		}
		function lazyInitializer(payload) {
			if (-1 === payload._status) {
				var ioInfo = payload._ioInfo;
				null != ioInfo && (ioInfo.start = ioInfo.end = performance.now());
				ioInfo = payload._result;
				var thenable = ioInfo();
				thenable.then(function(moduleObject) {
					if (0 === payload._status || -1 === payload._status) {
						payload._status = 1;
						payload._result = moduleObject;
						var _ioInfo = payload._ioInfo;
						null != _ioInfo && (_ioInfo.end = performance.now());
						void 0 === thenable.status && (thenable.status = "fulfilled", thenable.value = moduleObject);
					}
				}, function(error) {
					if (0 === payload._status || -1 === payload._status) {
						payload._status = 2;
						payload._result = error;
						var _ioInfo2 = payload._ioInfo;
						null != _ioInfo2 && (_ioInfo2.end = performance.now());
						void 0 === thenable.status && (thenable.status = "rejected", thenable.reason = error);
					}
				});
				ioInfo = payload._ioInfo;
				if (null != ioInfo) {
					ioInfo.value = thenable;
					var displayName = thenable.displayName;
					"string" === typeof displayName && (ioInfo.name = displayName);
				}
				-1 === payload._status && (payload._status = 0, payload._result = thenable);
			}
			if (1 === payload._status) return ioInfo = payload._result, void 0 === ioInfo && console.error("lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))\n\nDid you accidentally put curly braces around the import?", ioInfo), "default" in ioInfo || console.error("lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))", ioInfo), ioInfo.default;
			throw payload._result;
		}
		function resolveDispatcher() {
			var dispatcher = ReactSharedInternals.H;
			null === dispatcher && console.error("Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:\n1. You might have mismatching versions of React and the renderer (such as React DOM)\n2. You might be breaking the Rules of Hooks\n3. You might have more than one copy of React in the same app\nSee https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem.");
			return dispatcher;
		}
		function releaseAsyncTransition() {
			ReactSharedInternals.asyncTransitions--;
		}
		function enqueueTask(task) {
			if (null === enqueueTaskImpl) try {
				var requireString = ("require" + Math.random()).slice(0, 7);
				enqueueTaskImpl = (module && module[requireString]).call(module, "timers").setImmediate;
			} catch (_err) {
				enqueueTaskImpl = function(callback) {
					!1 === didWarnAboutMessageChannel && (didWarnAboutMessageChannel = !0, "undefined" === typeof MessageChannel && console.error("This browser does not have a MessageChannel implementation, so enqueuing tasks via await act(async () => ...) will fail. Please file an issue at https://github.com/facebook/react/issues if you encounter this warning."));
					var channel = new MessageChannel();
					channel.port1.onmessage = callback;
					channel.port2.postMessage(void 0);
				};
			}
			return enqueueTaskImpl(task);
		}
		function aggregateErrors(errors) {
			return 1 < errors.length && "function" === typeof AggregateError ? new AggregateError(errors) : errors[0];
		}
		function popActScope(prevActQueue, prevActScopeDepth) {
			prevActScopeDepth !== actScopeDepth - 1 && console.error("You seem to have overlapping act() calls, this is not supported. Be sure to await previous act() calls before making a new one. ");
			actScopeDepth = prevActScopeDepth;
		}
		function recursivelyFlushAsyncActWork(returnValue, resolve, reject) {
			var queue = ReactSharedInternals.actQueue;
			if (null !== queue) if (0 !== queue.length) try {
				flushActQueue(queue);
				enqueueTask(function() {
					return recursivelyFlushAsyncActWork(returnValue, resolve, reject);
				});
				return;
			} catch (error) {
				ReactSharedInternals.thrownErrors.push(error);
			}
			else ReactSharedInternals.actQueue = null;
			0 < ReactSharedInternals.thrownErrors.length ? (queue = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, reject(queue)) : resolve(returnValue);
		}
		function flushActQueue(queue) {
			if (!isFlushing) {
				isFlushing = !0;
				var i = 0;
				try {
					for (; i < queue.length; i++) {
						var callback = queue[i];
						do {
							ReactSharedInternals.didUsePromise = !1;
							var continuation = callback(!1);
							if (null !== continuation) {
								if (ReactSharedInternals.didUsePromise) {
									queue[i] = callback;
									queue.splice(0, i);
									return;
								}
								callback = continuation;
							} else break;
						} while (1);
					}
					queue.length = 0;
				} catch (error) {
					queue.splice(0, i + 1), ReactSharedInternals.thrownErrors.push(error);
				} finally {
					isFlushing = !1;
				}
			}
		}
		"undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
		var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = Symbol.for("react.activity"), MAYBE_ITERATOR_SYMBOL = Symbol.iterator, didWarnStateUpdateForUnmountedComponent = {}, ReactNoopUpdateQueue = {
			isMounted: function() {
				return !1;
			},
			enqueueForceUpdate: function(publicInstance) {
				warnNoop(publicInstance, "forceUpdate");
			},
			enqueueReplaceState: function(publicInstance) {
				warnNoop(publicInstance, "replaceState");
			},
			enqueueSetState: function(publicInstance) {
				warnNoop(publicInstance, "setState");
			}
		}, assign = Object.assign, emptyObject = {};
		Object.freeze(emptyObject);
		Component.prototype.isReactComponent = {};
		Component.prototype.setState = function(partialState, callback) {
			if ("object" !== typeof partialState && "function" !== typeof partialState && null != partialState) throw Error("takes an object of state variables to update or a function which returns an object of state variables.");
			this.updater.enqueueSetState(this, partialState, callback, "setState");
		};
		Component.prototype.forceUpdate = function(callback) {
			this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
		};
		var deprecatedAPIs = {
			isMounted: ["isMounted", "Instead, make sure to clean up subscriptions and pending requests in componentWillUnmount to prevent memory leaks."],
			replaceState: ["replaceState", "Refactor your code to use setState instead (see https://github.com/facebook/react/issues/3236)."]
		};
		for (fnName in deprecatedAPIs) deprecatedAPIs.hasOwnProperty(fnName) && defineDeprecationWarning(fnName, deprecatedAPIs[fnName]);
		ComponentDummy.prototype = Component.prototype;
		deprecatedAPIs = PureComponent.prototype = new ComponentDummy();
		deprecatedAPIs.constructor = PureComponent;
		assign(deprecatedAPIs, Component.prototype);
		deprecatedAPIs.isPureReactComponent = !0;
		var isArrayImpl = Array.isArray, REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference"), ReactSharedInternals = {
			H: null,
			A: null,
			T: null,
			S: null,
			actQueue: null,
			asyncTransitions: 0,
			isBatchingLegacy: !1,
			didScheduleLegacyUpdate: !1,
			didUsePromise: !1,
			thrownErrors: [],
			getCurrentStack: null,
			recentlyCreatedOwnerStacks: 0
		}, hasOwnProperty = Object.prototype.hasOwnProperty, createTask = console.createTask ? console.createTask : function() {
			return null;
		};
		deprecatedAPIs = { react_stack_bottom_frame: function(callStackForError) {
			return callStackForError();
		} };
		var specialPropKeyWarningShown, didWarnAboutOldJSXRuntime;
		var didWarnAboutElementRef = {};
		var unknownOwnerDebugStack = deprecatedAPIs.react_stack_bottom_frame.bind(deprecatedAPIs, UnknownOwner)();
		var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
		var didWarnAboutMaps = !1, userProvidedKeyEscapeRegex = /\/+/g, reportGlobalError = "function" === typeof reportError ? reportError : function(error) {
			if ("object" === typeof window && "function" === typeof window.ErrorEvent) {
				var event = new window.ErrorEvent("error", {
					bubbles: !0,
					cancelable: !0,
					message: "object" === typeof error && null !== error && "string" === typeof error.message ? String(error.message) : String(error),
					error
				});
				if (!window.dispatchEvent(event)) return;
			} else if ("object" === typeof process && "function" === typeof process.emit) {
				process.emit("uncaughtException", error);
				return;
			}
			console.error(error);
		}, didWarnAboutMessageChannel = !1, enqueueTaskImpl = null, actScopeDepth = 0, didWarnNoAwaitAct = !1, isFlushing = !1, queueSeveralMicrotasks = "function" === typeof queueMicrotask ? function(callback) {
			queueMicrotask(function() {
				return queueMicrotask(callback);
			});
		} : enqueueTask;
		deprecatedAPIs = Object.freeze({
			__proto__: null,
			c: function(size) {
				return resolveDispatcher().useMemoCache(size);
			}
		});
		var fnName = {
			map: mapChildren,
			forEach: function(children, forEachFunc, forEachContext) {
				mapChildren(children, function() {
					forEachFunc.apply(this, arguments);
				}, forEachContext);
			},
			count: function(children) {
				var n = 0;
				mapChildren(children, function() {
					n++;
				});
				return n;
			},
			toArray: function(children) {
				return mapChildren(children, function(child) {
					return child;
				}) || [];
			},
			only: function(children) {
				if (!isValidElement(children)) throw Error("React.Children.only expected to receive a single React element child.");
				return children;
			}
		};
		exports.Activity = REACT_ACTIVITY_TYPE;
		exports.Children = fnName;
		exports.Component = Component;
		exports.Fragment = REACT_FRAGMENT_TYPE;
		exports.Profiler = REACT_PROFILER_TYPE;
		exports.PureComponent = PureComponent;
		exports.StrictMode = REACT_STRICT_MODE_TYPE;
		exports.Suspense = REACT_SUSPENSE_TYPE;
		exports.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = ReactSharedInternals;
		exports.__COMPILER_RUNTIME = deprecatedAPIs;
		exports.act = function(callback) {
			var prevActQueue = ReactSharedInternals.actQueue, prevActScopeDepth = actScopeDepth;
			actScopeDepth++;
			var queue = ReactSharedInternals.actQueue = null !== prevActQueue ? prevActQueue : [], didAwaitActCall = !1;
			try {
				var result = callback();
			} catch (error) {
				ReactSharedInternals.thrownErrors.push(error);
			}
			if (0 < ReactSharedInternals.thrownErrors.length) throw popActScope(prevActQueue, prevActScopeDepth), callback = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, callback;
			if (null !== result && "object" === typeof result && "function" === typeof result.then) {
				var thenable = result;
				queueSeveralMicrotasks(function() {
					didAwaitActCall || didWarnNoAwaitAct || (didWarnNoAwaitAct = !0, console.error("You called act(async () => ...) without await. This could lead to unexpected testing behaviour, interleaving multiple act calls and mixing their scopes. You should - await act(async () => ...);"));
				});
				return { then: function(resolve, reject) {
					didAwaitActCall = !0;
					thenable.then(function(returnValue) {
						popActScope(prevActQueue, prevActScopeDepth);
						if (0 === prevActScopeDepth) {
							try {
								flushActQueue(queue), enqueueTask(function() {
									return recursivelyFlushAsyncActWork(returnValue, resolve, reject);
								});
							} catch (error$0) {
								ReactSharedInternals.thrownErrors.push(error$0);
							}
							if (0 < ReactSharedInternals.thrownErrors.length) {
								var _thrownError = aggregateErrors(ReactSharedInternals.thrownErrors);
								ReactSharedInternals.thrownErrors.length = 0;
								reject(_thrownError);
							}
						} else resolve(returnValue);
					}, function(error) {
						popActScope(prevActQueue, prevActScopeDepth);
						0 < ReactSharedInternals.thrownErrors.length ? (error = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, reject(error)) : reject(error);
					});
				} };
			}
			var returnValue$jscomp$0 = result;
			popActScope(prevActQueue, prevActScopeDepth);
			0 === prevActScopeDepth && (flushActQueue(queue), 0 !== queue.length && queueSeveralMicrotasks(function() {
				didAwaitActCall || didWarnNoAwaitAct || (didWarnNoAwaitAct = !0, console.error("A component suspended inside an `act` scope, but the `act` call was not awaited. When testing React components that depend on asynchronous data, you must await the result:\n\nawait act(() => ...)"));
			}), ReactSharedInternals.actQueue = null);
			if (0 < ReactSharedInternals.thrownErrors.length) throw callback = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, callback;
			return { then: function(resolve, reject) {
				didAwaitActCall = !0;
				0 === prevActScopeDepth ? (ReactSharedInternals.actQueue = queue, enqueueTask(function() {
					return recursivelyFlushAsyncActWork(returnValue$jscomp$0, resolve, reject);
				})) : resolve(returnValue$jscomp$0);
			} };
		};
		exports.cache = function(fn) {
			return function() {
				return fn.apply(null, arguments);
			};
		};
		exports.cacheSignal = function() {
			return null;
		};
		exports.captureOwnerStack = function() {
			var getCurrentStack = ReactSharedInternals.getCurrentStack;
			return null === getCurrentStack ? null : getCurrentStack();
		};
		exports.cloneElement = function(element, config, children) {
			if (null === element || void 0 === element) throw Error("The argument must be a React element, but you passed " + element + ".");
			var props = assign({}, element.props), key = element.key, owner = element._owner;
			if (null != config) {
				var JSCompiler_inline_result;
				a: {
					if (hasOwnProperty.call(config, "ref") && (JSCompiler_inline_result = Object.getOwnPropertyDescriptor(config, "ref").get) && JSCompiler_inline_result.isReactWarning) {
						JSCompiler_inline_result = !1;
						break a;
					}
					JSCompiler_inline_result = void 0 !== config.ref;
				}
				JSCompiler_inline_result && (owner = getOwner());
				hasValidKey(config) && (checkKeyStringCoercion(config.key), key = "" + config.key);
				for (propName in config) !hasOwnProperty.call(config, propName) || "key" === propName || "__self" === propName || "__source" === propName || "ref" === propName && void 0 === config.ref || (props[propName] = config[propName]);
			}
			var propName = arguments.length - 2;
			if (1 === propName) props.children = children;
			else if (1 < propName) {
				JSCompiler_inline_result = Array(propName);
				for (var i = 0; i < propName; i++) JSCompiler_inline_result[i] = arguments[i + 2];
				props.children = JSCompiler_inline_result;
			}
			props = ReactElement(element.type, key, props, owner, element._debugStack, element._debugTask);
			for (key = 2; key < arguments.length; key++) validateChildKeys(arguments[key]);
			return props;
		};
		exports.createContext = function(defaultValue) {
			defaultValue = {
				$$typeof: REACT_CONTEXT_TYPE,
				_currentValue: defaultValue,
				_currentValue2: defaultValue,
				_threadCount: 0,
				Provider: null,
				Consumer: null
			};
			defaultValue.Provider = defaultValue;
			defaultValue.Consumer = {
				$$typeof: REACT_CONSUMER_TYPE,
				_context: defaultValue
			};
			defaultValue._currentRenderer = null;
			defaultValue._currentRenderer2 = null;
			return defaultValue;
		};
		exports.createElement = function(type, config, children) {
			for (var i = 2; i < arguments.length; i++) validateChildKeys(arguments[i]);
			i = {};
			var key = null;
			if (null != config) for (propName in didWarnAboutOldJSXRuntime || !("__self" in config) || "key" in config || (didWarnAboutOldJSXRuntime = !0, console.warn("Your app (or one of its dependencies) is using an outdated JSX transform. Update to the modern JSX transform for faster performance: https://react.dev/link/new-jsx-transform")), hasValidKey(config) && (checkKeyStringCoercion(config.key), key = "" + config.key), config) hasOwnProperty.call(config, propName) && "key" !== propName && "__self" !== propName && "__source" !== propName && (i[propName] = config[propName]);
			var childrenLength = arguments.length - 2;
			if (1 === childrenLength) i.children = children;
			else if (1 < childrenLength) {
				for (var childArray = Array(childrenLength), _i = 0; _i < childrenLength; _i++) childArray[_i] = arguments[_i + 2];
				Object.freeze && Object.freeze(childArray);
				i.children = childArray;
			}
			if (type && type.defaultProps) for (propName in childrenLength = type.defaultProps, childrenLength) void 0 === i[propName] && (i[propName] = childrenLength[propName]);
			key && defineKeyPropWarningGetter(i, "function" === typeof type ? type.displayName || type.name || "Unknown" : type);
			var propName = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
			return ReactElement(type, key, i, getOwner(), propName ? Error("react-stack-top-frame") : unknownOwnerDebugStack, propName ? createTask(getTaskName(type)) : unknownOwnerDebugTask);
		};
		exports.createRef = function() {
			var refObject = { current: null };
			Object.seal(refObject);
			return refObject;
		};
		exports.forwardRef = function(render) {
			null != render && render.$$typeof === REACT_MEMO_TYPE ? console.error("forwardRef requires a render function but received a `memo` component. Instead of forwardRef(memo(...)), use memo(forwardRef(...)).") : "function" !== typeof render ? console.error("forwardRef requires a render function but was given %s.", null === render ? "null" : typeof render) : 0 !== render.length && 2 !== render.length && console.error("forwardRef render functions accept exactly two parameters: props and ref. %s", 1 === render.length ? "Did you forget to use the ref parameter?" : "Any additional parameter will be undefined.");
			null != render && null != render.defaultProps && console.error("forwardRef render functions do not support defaultProps. Did you accidentally pass a React component?");
			var elementType = {
				$$typeof: REACT_FORWARD_REF_TYPE,
				render
			}, ownName;
			Object.defineProperty(elementType, "displayName", {
				enumerable: !1,
				configurable: !0,
				get: function() {
					return ownName;
				},
				set: function(name) {
					ownName = name;
					render.name || render.displayName || (Object.defineProperty(render, "name", { value: name }), render.displayName = name);
				}
			});
			return elementType;
		};
		exports.isValidElement = isValidElement;
		exports.lazy = function(ctor) {
			ctor = {
				_status: -1,
				_result: ctor
			};
			var lazyType = {
				$$typeof: REACT_LAZY_TYPE,
				_payload: ctor,
				_init: lazyInitializer
			}, ioInfo = {
				name: "lazy",
				start: -1,
				end: -1,
				value: null,
				owner: null,
				debugStack: Error("react-stack-top-frame"),
				debugTask: console.createTask ? console.createTask("lazy()") : null
			};
			ctor._ioInfo = ioInfo;
			lazyType._debugInfo = [{ awaited: ioInfo }];
			return lazyType;
		};
		exports.memo = function(type, compare) {
			type ?? console.error("memo: The first argument must be a component. Instead received: %s", null === type ? "null" : typeof type);
			compare = {
				$$typeof: REACT_MEMO_TYPE,
				type,
				compare: void 0 === compare ? null : compare
			};
			var ownName;
			Object.defineProperty(compare, "displayName", {
				enumerable: !1,
				configurable: !0,
				get: function() {
					return ownName;
				},
				set: function(name) {
					ownName = name;
					type.name || type.displayName || (Object.defineProperty(type, "name", { value: name }), type.displayName = name);
				}
			});
			return compare;
		};
		exports.startTransition = function(scope) {
			var prevTransition = ReactSharedInternals.T, currentTransition = {};
			currentTransition._updatedFibers = /* @__PURE__ */ new Set();
			ReactSharedInternals.T = currentTransition;
			try {
				var returnValue = scope(), onStartTransitionFinish = ReactSharedInternals.S;
				null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
				"object" === typeof returnValue && null !== returnValue && "function" === typeof returnValue.then && (ReactSharedInternals.asyncTransitions++, returnValue.then(releaseAsyncTransition, releaseAsyncTransition), returnValue.then(noop, reportGlobalError));
			} catch (error) {
				reportGlobalError(error);
			} finally {
				null === prevTransition && currentTransition._updatedFibers && (scope = currentTransition._updatedFibers.size, currentTransition._updatedFibers.clear(), 10 < scope && console.warn("Detected a large number of updates inside startTransition. If this is due to a subscription please re-write it to use React provided hooks. Otherwise concurrent mode guarantees are off the table.")), null !== prevTransition && null !== currentTransition.types && (null !== prevTransition.types && prevTransition.types !== currentTransition.types && console.error("We expected inner Transitions to have transferred the outer types set and that you cannot add to the outer Transition while inside the inner.This is a bug in React."), prevTransition.types = currentTransition.types), ReactSharedInternals.T = prevTransition;
			}
		};
		exports.unstable_useCacheRefresh = function() {
			return resolveDispatcher().useCacheRefresh();
		};
		exports.use = function(usable) {
			return resolveDispatcher().use(usable);
		};
		exports.useActionState = function(action, initialState, permalink) {
			return resolveDispatcher().useActionState(action, initialState, permalink);
		};
		exports.useCallback = function(callback, deps) {
			return resolveDispatcher().useCallback(callback, deps);
		};
		exports.useContext = function(Context) {
			var dispatcher = resolveDispatcher();
			Context.$$typeof === REACT_CONSUMER_TYPE && console.error("Calling useContext(Context.Consumer) is not supported and will cause bugs. Did you mean to call useContext(Context) instead?");
			return dispatcher.useContext(Context);
		};
		exports.useDebugValue = function(value, formatterFn) {
			return resolveDispatcher().useDebugValue(value, formatterFn);
		};
		exports.useDeferredValue = function(value, initialValue) {
			return resolveDispatcher().useDeferredValue(value, initialValue);
		};
		exports.useEffect = function(create, deps) {
			create ?? console.warn("React Hook useEffect requires an effect callback. Did you forget to pass a callback to the hook?");
			return resolveDispatcher().useEffect(create, deps);
		};
		exports.useEffectEvent = function(callback) {
			return resolveDispatcher().useEffectEvent(callback);
		};
		exports.useId = function() {
			return resolveDispatcher().useId();
		};
		exports.useImperativeHandle = function(ref, create, deps) {
			return resolveDispatcher().useImperativeHandle(ref, create, deps);
		};
		exports.useInsertionEffect = function(create, deps) {
			create ?? console.warn("React Hook useInsertionEffect requires an effect callback. Did you forget to pass a callback to the hook?");
			return resolveDispatcher().useInsertionEffect(create, deps);
		};
		exports.useLayoutEffect = function(create, deps) {
			create ?? console.warn("React Hook useLayoutEffect requires an effect callback. Did you forget to pass a callback to the hook?");
			return resolveDispatcher().useLayoutEffect(create, deps);
		};
		exports.useMemo = function(create, deps) {
			return resolveDispatcher().useMemo(create, deps);
		};
		exports.useOptimistic = function(passthrough, reducer) {
			return resolveDispatcher().useOptimistic(passthrough, reducer);
		};
		exports.useReducer = function(reducer, initialArg, init) {
			return resolveDispatcher().useReducer(reducer, initialArg, init);
		};
		exports.useRef = function(initialValue) {
			return resolveDispatcher().useRef(initialValue);
		};
		exports.useState = function(initialState) {
			return resolveDispatcher().useState(initialState);
		};
		exports.useSyncExternalStore = function(subscribe, getSnapshot, getServerSnapshot) {
			return resolveDispatcher().useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
		};
		exports.useTransition = function() {
			return resolveDispatcher().useTransition();
		};
		exports.version = "19.2.7";
		"undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
	})();
}));
//#endregion
//#region node_modules/react/index.js
var require_react = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	if (process.env.NODE_ENV === "production") module.exports = require_react_production();
	else module.exports = require_react_development();
}));
//#endregion
//#region node_modules/react/cjs/react-jsx-runtime.production.js
/**
* @license React
* react-jsx-runtime.production.js
*
* Copyright (c) Meta Platforms, Inc. and affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
var require_react_jsx_runtime_production = /* @__PURE__ */ __commonJSMin(((exports) => {
	var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
	function jsxProd(type, config, maybeKey) {
		var key = null;
		void 0 !== maybeKey && (key = "" + maybeKey);
		void 0 !== config.key && (key = "" + config.key);
		if ("key" in config) {
			maybeKey = {};
			for (var propName in config) "key" !== propName && (maybeKey[propName] = config[propName]);
		} else maybeKey = config;
		config = maybeKey.ref;
		return {
			$$typeof: REACT_ELEMENT_TYPE,
			type,
			key,
			ref: void 0 !== config ? config : null,
			props: maybeKey
		};
	}
	exports.Fragment = REACT_FRAGMENT_TYPE;
	exports.jsx = jsxProd;
	exports.jsxs = jsxProd;
}));
//#endregion
//#region node_modules/react/cjs/react-jsx-runtime.development.js
/**
* @license React
* react-jsx-runtime.development.js
*
* Copyright (c) Meta Platforms, Inc. and affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
var require_react_jsx_runtime_development = /* @__PURE__ */ __commonJSMin(((exports) => {
	"production" !== process.env.NODE_ENV && (function() {
		function getComponentNameFromType(type) {
			if (null == type) return null;
			if ("function" === typeof type) return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
			if ("string" === typeof type) return type;
			switch (type) {
				case REACT_FRAGMENT_TYPE: return "Fragment";
				case REACT_PROFILER_TYPE: return "Profiler";
				case REACT_STRICT_MODE_TYPE: return "StrictMode";
				case REACT_SUSPENSE_TYPE: return "Suspense";
				case REACT_SUSPENSE_LIST_TYPE: return "SuspenseList";
				case REACT_ACTIVITY_TYPE: return "Activity";
			}
			if ("object" === typeof type) switch ("number" === typeof type.tag && console.error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."), type.$$typeof) {
				case REACT_PORTAL_TYPE: return "Portal";
				case REACT_CONTEXT_TYPE: return type.displayName || "Context";
				case REACT_CONSUMER_TYPE: return (type._context.displayName || "Context") + ".Consumer";
				case REACT_FORWARD_REF_TYPE:
					var innerType = type.render;
					type = type.displayName;
					type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
					return type;
				case REACT_MEMO_TYPE: return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
				case REACT_LAZY_TYPE:
					innerType = type._payload;
					type = type._init;
					try {
						return getComponentNameFromType(type(innerType));
					} catch (x) {}
			}
			return null;
		}
		function testStringCoercion(value) {
			return "" + value;
		}
		function checkKeyStringCoercion(value) {
			try {
				testStringCoercion(value);
				var JSCompiler_inline_result = !1;
			} catch (e) {
				JSCompiler_inline_result = !0;
			}
			if (JSCompiler_inline_result) {
				JSCompiler_inline_result = console;
				var JSCompiler_temp_const = JSCompiler_inline_result.error;
				var JSCompiler_inline_result$jscomp$0 = "function" === typeof Symbol && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
				JSCompiler_temp_const.call(JSCompiler_inline_result, "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.", JSCompiler_inline_result$jscomp$0);
				return testStringCoercion(value);
			}
		}
		function getTaskName(type) {
			if (type === REACT_FRAGMENT_TYPE) return "<>";
			if ("object" === typeof type && null !== type && type.$$typeof === REACT_LAZY_TYPE) return "<...>";
			try {
				var name = getComponentNameFromType(type);
				return name ? "<" + name + ">" : "<...>";
			} catch (x) {
				return "<...>";
			}
		}
		function getOwner() {
			var dispatcher = ReactSharedInternals.A;
			return null === dispatcher ? null : dispatcher.getOwner();
		}
		function UnknownOwner() {
			return Error("react-stack-top-frame");
		}
		function hasValidKey(config) {
			if (hasOwnProperty.call(config, "key")) {
				var getter = Object.getOwnPropertyDescriptor(config, "key").get;
				if (getter && getter.isReactWarning) return !1;
			}
			return void 0 !== config.key;
		}
		function defineKeyPropWarningGetter(props, displayName) {
			function warnAboutAccessingKey() {
				specialPropKeyWarningShown || (specialPropKeyWarningShown = !0, console.error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)", displayName));
			}
			warnAboutAccessingKey.isReactWarning = !0;
			Object.defineProperty(props, "key", {
				get: warnAboutAccessingKey,
				configurable: !0
			});
		}
		function elementRefGetterWithDeprecationWarning() {
			var componentName = getComponentNameFromType(this.type);
			didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = !0, console.error("Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."));
			componentName = this.props.ref;
			return void 0 !== componentName ? componentName : null;
		}
		function ReactElement(type, key, props, owner, debugStack, debugTask) {
			var refProp = props.ref;
			type = {
				$$typeof: REACT_ELEMENT_TYPE,
				type,
				key,
				props,
				_owner: owner
			};
			null !== (void 0 !== refProp ? refProp : null) ? Object.defineProperty(type, "ref", {
				enumerable: !1,
				get: elementRefGetterWithDeprecationWarning
			}) : Object.defineProperty(type, "ref", {
				enumerable: !1,
				value: null
			});
			type._store = {};
			Object.defineProperty(type._store, "validated", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: 0
			});
			Object.defineProperty(type, "_debugInfo", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: null
			});
			Object.defineProperty(type, "_debugStack", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: debugStack
			});
			Object.defineProperty(type, "_debugTask", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: debugTask
			});
			Object.freeze && (Object.freeze(type.props), Object.freeze(type));
			return type;
		}
		function jsxDEVImpl(type, config, maybeKey, isStaticChildren, debugStack, debugTask) {
			var children = config.children;
			if (void 0 !== children) if (isStaticChildren) if (isArrayImpl(children)) {
				for (isStaticChildren = 0; isStaticChildren < children.length; isStaticChildren++) validateChildKeys(children[isStaticChildren]);
				Object.freeze && Object.freeze(children);
			} else console.error("React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead.");
			else validateChildKeys(children);
			if (hasOwnProperty.call(config, "key")) {
				children = getComponentNameFromType(type);
				var keys = Object.keys(config).filter(function(k) {
					return "key" !== k;
				});
				isStaticChildren = 0 < keys.length ? "{key: someKey, " + keys.join(": ..., ") + ": ...}" : "{key: someKey}";
				didWarnAboutKeySpread[children + isStaticChildren] || (keys = 0 < keys.length ? "{" + keys.join(": ..., ") + ": ...}" : "{}", console.error("A props object containing a \"key\" prop is being spread into JSX:\n  let props = %s;\n  <%s {...props} />\nReact keys must be passed directly to JSX without using spread:\n  let props = %s;\n  <%s key={someKey} {...props} />", isStaticChildren, children, keys, children), didWarnAboutKeySpread[children + isStaticChildren] = !0);
			}
			children = null;
			void 0 !== maybeKey && (checkKeyStringCoercion(maybeKey), children = "" + maybeKey);
			hasValidKey(config) && (checkKeyStringCoercion(config.key), children = "" + config.key);
			if ("key" in config) {
				maybeKey = {};
				for (var propName in config) "key" !== propName && (maybeKey[propName] = config[propName]);
			} else maybeKey = config;
			children && defineKeyPropWarningGetter(maybeKey, "function" === typeof type ? type.displayName || type.name || "Unknown" : type);
			return ReactElement(type, children, maybeKey, getOwner(), debugStack, debugTask);
		}
		function validateChildKeys(node) {
			isValidElement(node) ? node._store && (node._store.validated = 1) : "object" === typeof node && null !== node && node.$$typeof === REACT_LAZY_TYPE && ("fulfilled" === node._payload.status ? isValidElement(node._payload.value) && node._payload.value._store && (node._payload.value._store.validated = 1) : node._store && (node._store.validated = 1));
		}
		function isValidElement(object) {
			return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
		}
		var React = require_react(), REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = Symbol.for("react.activity"), REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference"), ReactSharedInternals = React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, hasOwnProperty = Object.prototype.hasOwnProperty, isArrayImpl = Array.isArray, createTask = console.createTask ? console.createTask : function() {
			return null;
		};
		React = { react_stack_bottom_frame: function(callStackForError) {
			return callStackForError();
		} };
		var specialPropKeyWarningShown;
		var didWarnAboutElementRef = {};
		var unknownOwnerDebugStack = React.react_stack_bottom_frame.bind(React, UnknownOwner)();
		var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
		var didWarnAboutKeySpread = {};
		exports.Fragment = REACT_FRAGMENT_TYPE;
		exports.jsx = function(type, config, maybeKey) {
			var trackActualOwner = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
			return jsxDEVImpl(type, config, maybeKey, !1, trackActualOwner ? Error("react-stack-top-frame") : unknownOwnerDebugStack, trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask);
		};
		exports.jsxs = function(type, config, maybeKey) {
			var trackActualOwner = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
			return jsxDEVImpl(type, config, maybeKey, !0, trackActualOwner ? Error("react-stack-top-frame") : unknownOwnerDebugStack, trackActualOwner ? createTask(getTaskName(type)) : unknownOwnerDebugTask);
		};
	})();
}));
//#endregion
//#region node_modules/react/jsx-runtime.js
var require_jsx_runtime = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	if (process.env.NODE_ENV === "production") module.exports = require_react_jsx_runtime_production();
	else module.exports = require_react_jsx_runtime_development();
}));
//#endregion
//#region src/components/Toast.tsx
var import_react = require_react();
require_jsx_runtime();
(0, import_react.createContext)({ toast: () => {} });
localStorage.getItem("zhiwei_token");
//#endregion
//#region ../shared/subjects.ts
var SUBJECTS_CN = {
	chinese: "语文",
	math: "数学",
	english: "英语",
	physics: "物理",
	chemistry: "化学",
	biology: "生物",
	history: "历史",
	geography: "地理",
	politics: "政治"
};
var SUBJECT_CODES = Object.fromEntries(Object.entries(SUBJECTS_CN).map(([code, cn]) => [cn, code]));
Object.values(SUBJECTS_CN);
//#endregion
//#region src/lib/cwTemplate.ts
var STYLE_LABELS = {
	china: "国风",
	minimal: "素净",
	tech: "科技",
	fresh: "清新",
	academic: "严谨",
	cartoon: "卡通",
	flat: "扁平",
	business: "沉稳",
	basic: "通用"
};
function pickContentLayout(itemCount) {
	if (itemCount <= 1) return "content-1col";
	if (itemCount === 2) return "content-2col";
	if (itemCount === 3) return "content-3col";
	if (itemCount === 4) return "content-4col";
	return "content-grid";
}
function subjectKey(subject) {
	if (subject in SUBJECT_CODES) return subject;
	return "_default";
}
function subjectFamily(subject) {
	if ([
		"物理",
		"化学",
		"生物"
	].includes(subject)) return "science";
	if ([
		"历史",
		"地理",
		"政治"
	].includes(subject)) return "humanity";
	return subject;
}
var EDU_LAYOUT_SKELETONS = {
	"edu-cover": {
		hint: "封面：填写课题、年级学科与授课教师",
		placeholders: [{
			key: "title",
			label: "课题名称",
			kind: "title",
			rect: {
				x: 6,
				y: 30,
				w: 88,
				h: 14
			},
			fontSize: 36,
			bold: true,
			align: "center",
			placeholder: "课题名称（填写）"
		}, {
			key: "info",
			label: "年级 / 学科 / 教师",
			kind: "info-block",
			rect: {
				x: 6,
				y: 48,
				w: 88,
				h: 12
			},
			fontSize: 18,
			align: "center",
			placeholder: "年级 / 学科 / 授课教师"
		}]
	},
	"edu-goal": {
		hint: "教学目标：按三维目标分栏填写",
		placeholders: [
			{
				key: "knowledge",
				label: "知识与技能",
				kind: "bullet",
				rect: {
					x: 5.3,
					y: 22,
					w: 29,
					h: 60
				},
				columns: 1,
				placeholder: "知识与技能"
			},
			{
				key: "process",
				label: "过程与方法",
				kind: "bullet",
				rect: {
					x: 35.3,
					y: 22,
					w: 29,
					h: 60
				},
				columns: 1,
				placeholder: "过程与方法"
			},
			{
				key: "emotion",
				label: "情感态度价值观",
				kind: "bullet",
				rect: {
					x: 65.3,
					y: 22,
					w: 29,
					h: 60
				},
				columns: 1,
				placeholder: "情感态度价值观"
			}
		]
	},
	"edu-explain": {
		hint: "知识讲解：上方概念定义，下方要点展开",
		placeholders: [{
			key: "definition",
			label: "概念定义",
			kind: "body",
			rect: {
				x: 6,
				y: 20,
				w: 88,
				h: 18
			},
			fontSize: 18,
			placeholder: "概念定义（填写）"
		}, {
			key: "points",
			label: "要点展开",
			kind: "bullet",
			rect: {
				x: 6,
				y: 42,
				w: 88,
				h: 48
			},
			placeholder: "要点展开"
		}]
	},
	"edu-example": {
		hint: "例题演练：上方题干，下方解答步骤",
		placeholders: [{
			key: "question",
			label: "题干",
			kind: "body",
			rect: {
				x: 6.3,
				y: 20,
				w: 87.4,
				h: 18
			},
			fontSize: 18,
			bold: true,
			placeholder: "题干（填写）"
		}, {
			key: "solution",
			label: "解答步骤",
			kind: "bullet",
			rect: {
				x: 5.3,
				y: 44,
				w: 89.4,
				h: 40
			},
			columns: 3,
			placeholder: "解答步骤"
		}]
	},
	"edu-summary": {
		hint: "课堂小结：要点归纳 + 思维导图占位",
		placeholders: [{
			key: "points",
			label: "要点归纳",
			kind: "bullet",
			rect: {
				x: 6,
				y: 20,
				w: 88,
				h: 44
			},
			placeholder: "要点归纳"
		}, {
			key: "mindmap",
			label: "思维导图占位",
			kind: "info-block",
			rect: {
				x: 6,
				y: 68,
				w: 88,
				h: 22
			},
			placeholder: "思维导图占位"
		}]
	},
	"edu-homework": {
		hint: "作业布置：分层作业（基础 / 提高 / 拓展）",
		placeholders: [
			{
				key: "basic",
				label: "基础",
				kind: "bullet",
				rect: {
					x: 5.3,
					y: 22,
					w: 29,
					h: 60
				},
				columns: 1,
				placeholder: "基础"
			},
			{
				key: "improve",
				label: "提高",
				kind: "bullet",
				rect: {
					x: 35.3,
					y: 22,
					w: 29,
					h: 60
				},
				columns: 1,
				placeholder: "提高"
			},
			{
				key: "expand",
				label: "拓展",
				kind: "bullet",
				rect: {
					x: 65.3,
					y: 22,
					w: 29,
					h: 60
				},
				columns: 1,
				placeholder: "拓展"
			}
		]
	},
	"cover": {
		hint: "封面：标题 + 副标题 + 信息",
		placeholders: [
			{
				key: "title",
				label: "标题",
				kind: "title",
				rect: {
					x: 8,
					y: 32,
					w: 84,
					h: 16
				},
				fontSize: 36,
				bold: true,
				align: "center",
				placeholder: "标题（填写）"
			},
			{
				key: "subtitle",
				label: "副标题",
				kind: "body",
				rect: {
					x: 8,
					y: 50,
					w: 84,
					h: 10
				},
				fontSize: 18,
				align: "center",
				placeholder: "副标题"
			},
			{
				key: "info",
				label: "信息",
				kind: "info-block",
				rect: {
					x: 8,
					y: 62,
					w: 84,
					h: 8
				},
				fontSize: 14,
				align: "center",
				placeholder: "学科 / 年级 / 作者"
			}
		]
	},
	"toc": {
		hint: "目录：标题 + 目录项（≤6）",
		placeholders: [{
			key: "title",
			label: "目录标题",
			kind: "title",
			rect: {
				x: 8,
				y: 12,
				w: 84,
				h: 10
			},
			fontSize: 24,
			bold: true,
			placeholder: "目录"
		}, {
			key: "items",
			label: "目录项",
			kind: "bullet",
			rect: {
				x: 14,
				y: 30,
				w: 72,
				h: 56
			},
			columns: 1,
			placeholder: "目录项"
		}]
	},
	"section": {
		hint: "分隔页：章节标题",
		placeholders: [{
			key: "title",
			label: "章节标题",
			kind: "title",
			rect: {
				x: 10,
				y: 42,
				w: 80,
				h: 16
			},
			fontSize: 32,
			bold: true,
			align: "center",
			placeholder: "章节标题"
		}]
	},
	"content-1col": {
		hint: "单栏内容页",
		placeholders: [{
			key: "title",
			label: "标题",
			kind: "title",
			rect: {
				x: 6.3,
				y: 12,
				w: 87.4,
				h: 10
			},
			fontSize: 24,
			bold: true,
			placeholder: "标题"
		}, {
			key: "body",
			label: "内容",
			kind: "bullet",
			rect: {
				x: 6.3,
				y: 28,
				w: 87.4,
				h: 60
			},
			columns: 1,
			placeholder: "内容要点"
		}]
	},
	"content-2col": {
		hint: "双栏内容页",
		placeholders: [
			{
				key: "title",
				label: "标题",
				kind: "title",
				rect: {
					x: 6.3,
					y: 12,
					w: 87.4,
					h: 10
				},
				fontSize: 24,
				bold: true,
				placeholder: "标题"
			},
			{
				key: "left",
				label: "左栏",
				kind: "bullet",
				rect: {
					x: 6.3,
					y: 28,
					w: 43,
					h: 60
				},
				columns: 1,
				placeholder: "左栏内容"
			},
			{
				key: "right",
				label: "右栏",
				kind: "bullet",
				rect: {
					x: 50.7,
					y: 28,
					w: 43,
					h: 60
				},
				columns: 1,
				placeholder: "右栏内容"
			}
		]
	},
	"content-3col": {
		hint: "三栏内容页",
		placeholders: [
			{
				key: "title",
				label: "标题",
				kind: "title",
				rect: {
					x: 6.3,
					y: 12,
					w: 87.4,
					h: 10
				},
				fontSize: 24,
				bold: true,
				placeholder: "标题"
			},
			{
				key: "col1",
				label: "栏1",
				kind: "bullet",
				rect: {
					x: 6.3,
					y: 28,
					w: 28,
					h: 60
				},
				columns: 1,
				placeholder: "栏1"
			},
			{
				key: "col2",
				label: "栏2",
				kind: "bullet",
				rect: {
					x: 36.2,
					y: 28,
					w: 28,
					h: 60
				},
				columns: 1,
				placeholder: "栏2"
			},
			{
				key: "col3",
				label: "栏3",
				kind: "bullet",
				rect: {
					x: 66.1,
					y: 28,
					w: 28,
					h: 60
				},
				columns: 1,
				placeholder: "栏3"
			}
		]
	},
	"content-4col": {
		hint: "四栏内容页",
		placeholders: [
			{
				key: "title",
				label: "标题",
				kind: "title",
				rect: {
					x: 6.3,
					y: 12,
					w: 87.4,
					h: 10
				},
				fontSize: 24,
				bold: true,
				placeholder: "标题"
			},
			{
				key: "col1",
				label: "栏1",
				kind: "bullet",
				rect: {
					x: 6.3,
					y: 28,
					w: 20.5,
					h: 60
				},
				columns: 1,
				placeholder: "栏1"
			},
			{
				key: "col2",
				label: "栏2",
				kind: "bullet",
				rect: {
					x: 29.2,
					y: 28,
					w: 20.5,
					h: 60
				},
				columns: 1,
				placeholder: "栏2"
			},
			{
				key: "col3",
				label: "栏3",
				kind: "bullet",
				rect: {
					x: 52.1,
					y: 28,
					w: 20.5,
					h: 60
				},
				columns: 1,
				placeholder: "栏3"
			},
			{
				key: "col4",
				label: "栏4",
				kind: "bullet",
				rect: {
					x: 75,
					y: 28,
					w: 20.5,
					h: 60
				},
				columns: 1,
				placeholder: "栏4"
			}
		]
	},
	"content-grid": {
		hint: "网格内容页（2-6项自适应列数）",
		placeholders: [{
			key: "title",
			label: "标题",
			kind: "title",
			rect: {
				x: 6.3,
				y: 12,
				w: 87.4,
				h: 10
			},
			fontSize: 24,
			bold: true,
			placeholder: "标题"
		}, {
			key: "items",
			label: "网格项",
			kind: "bullet",
			rect: {
				x: 6.3,
				y: 28,
				w: 87.4,
				h: 60
			},
			columns: 3,
			placeholder: "网格项"
		}]
	},
	"summary": {
		hint: "总结页：标题 + 要点（≤6）",
		placeholders: [{
			key: "title",
			label: "总结标题",
			kind: "title",
			rect: {
				x: 6.3,
				y: 12,
				w: 87.4,
				h: 10
			},
			fontSize: 24,
			bold: true,
			placeholder: "课堂小结"
		}, {
			key: "items",
			label: "要点",
			kind: "bullet",
			rect: {
				x: 6.3,
				y: 28,
				w: 87.4,
				h: 60
			},
			columns: 2,
			placeholder: "要点"
		}]
	},
	"comparison": {
		hint: "对比页：左右两栏",
		placeholders: [
			{
				key: "title",
				label: "对比标题",
				kind: "title",
				rect: {
					x: 6.3,
					y: 12,
					w: 87.4,
					h: 10
				},
				fontSize: 24,
				bold: true,
				placeholder: "对比"
			},
			{
				key: "left",
				label: "左侧",
				kind: "bullet",
				rect: {
					x: 6.3,
					y: 28,
					w: 43,
					h: 60
				},
				columns: 1,
				placeholder: "左侧"
			},
			{
				key: "right",
				label: "右侧",
				kind: "bullet",
				rect: {
					x: 50.7,
					y: 28,
					w: 43,
					h: 60
				},
				columns: 1,
				placeholder: "右侧"
			}
		]
	},
	"timeline": {
		hint: "时间线页：事件序列（≤6）",
		placeholders: [{
			key: "title",
			label: "时间线标题",
			kind: "title",
			rect: {
				x: 6.3,
				y: 12,
				w: 87.4,
				h: 10
			},
			fontSize: 24,
			bold: true,
			placeholder: "时间线"
		}, {
			key: "events",
			label: "事件",
			kind: "bullet",
			rect: {
				x: 6.3,
				y: 30,
				w: 87.4,
				h: 56
			},
			columns: 1,
			placeholder: "事件节点"
		}]
	},
	"chart": {
		hint: "图表页：标题 + 数据/说明占位",
		placeholders: [{
			key: "title",
			label: "图表标题",
			kind: "title",
			rect: {
				x: 6.3,
				y: 12,
				w: 87.4,
				h: 10
			},
			fontSize: 24,
			bold: true,
			placeholder: "图表标题"
		}, {
			key: "data",
			label: "图表数据/说明",
			kind: "body",
			rect: {
				x: 6.3,
				y: 28,
				w: 87.4,
				h: 60
			},
			fontSize: 16,
			placeholder: "图表数据或说明"
		}]
	},
	"image-text": {
		hint: "图文混排：图片 + 文字",
		placeholders: [
			{
				key: "title",
				label: "标题",
				kind: "title",
				rect: {
					x: 6.3,
					y: 12,
					w: 87.4,
					h: 10
				},
				fontSize: 24,
				bold: true,
				placeholder: "标题"
			},
			{
				key: "image",
				label: "图片",
				kind: "info-block",
				rect: {
					x: 6.3,
					y: 28,
					w: 43,
					h: 58
				},
				placeholder: "图片占位"
			},
			{
				key: "body",
				label: "文字",
				kind: "bullet",
				rect: {
					x: 50.7,
					y: 28,
					w: 43,
					h: 58
				},
				columns: 1,
				placeholder: "文字说明"
			}
		]
	},
	"image-full": {
		hint: "全屏图片：图片 + 图注",
		placeholders: [{
			key: "image",
			label: "全屏图片",
			kind: "info-block",
			rect: {
				x: 6.3,
				y: 16,
				w: 87.4,
				h: 68
			},
			placeholder: "全屏图片"
		}, {
			key: "caption",
			label: "图注",
			kind: "body",
			rect: {
				x: 6.3,
				y: 86,
				w: 87.4,
				h: 8
			},
			fontSize: 14,
			align: "center",
			placeholder: "图注"
		}]
	}
};
var SK_LOW_BASE = {
	"edu-cover": {
		hint: "封面：课题大字号，配年级学科教师信息块",
		placeholders: [{
			key: "title",
			label: "课题名称（大字号）",
			kind: "title"
		}, {
			key: "info",
			label: "年级 / 学科 / 教师",
			kind: "info-block"
		}]
	},
	"edu-goal": {
		hint: "教学目标：三维目标，配图示意",
		placeholders: [
			{
				key: "knowledge",
				label: "知识与技能",
				kind: "bullet"
			},
			{
				key: "process",
				label: "过程与方法",
				kind: "bullet"
			},
			{
				key: "emotion",
				label: "情感态度价值观",
				kind: "bullet"
			}
		]
	},
	"edu-explain": {
		hint: "知识讲解：图文并重，概念+配图",
		placeholders: [
			{
				key: "definition",
				label: "概念定义",
				kind: "body"
			},
			{
				key: "picture",
				label: "配图/示意图",
				kind: "info-block"
			},
			{
				key: "points",
				label: "要点展开",
				kind: "bullet"
			}
		]
	},
	"edu-example": {
		hint: "例题演练：题干大字 + 分步",
		placeholders: [{
			key: "question",
			label: "题干（大字号）",
			kind: "body"
		}, {
			key: "solution",
			label: "解答步骤",
			kind: "bullet"
		}]
	},
	"edu-summary": {
		hint: "课堂小结：要点 + 趣味导图",
		placeholders: [{
			key: "points",
			label: "要点归纳",
			kind: "bullet"
		}, {
			key: "mindmap",
			label: "思维导图占位",
			kind: "info-block"
		}]
	},
	"edu-homework": {
		hint: "作业布置：分层（基础/提高/拓展）",
		placeholders: [
			{
				key: "basic",
				label: "基础",
				kind: "bullet"
			},
			{
				key: "improve",
				label: "提高",
				kind: "bullet"
			},
			{
				key: "expand",
				label: "拓展",
				kind: "bullet"
			}
		]
	}
};
var SK_UP_BASE = {
	"edu-cover": {
		hint: "封面：课题+年级学科教师信息块",
		placeholders: [{
			key: "title",
			label: "课题名称",
			kind: "title"
		}, {
			key: "info",
			label: "年级 / 学科 / 教师",
			kind: "info-block"
		}]
	},
	"edu-goal": {
		hint: "教学目标：三维目标分栏",
		placeholders: [
			{
				key: "knowledge",
				label: "知识与技能",
				kind: "bullet"
			},
			{
				key: "process",
				label: "过程与方法",
				kind: "bullet"
			},
			{
				key: "emotion",
				label: "情感态度价值观",
				kind: "bullet"
			}
		]
	},
	"edu-explain": {
		hint: "知识讲解：概念定义 + 要点",
		placeholders: [{
			key: "definition",
			label: "概念定义",
			kind: "body"
		}, {
			key: "points",
			label: "要点展开",
			kind: "bullet"
		}]
	},
	"edu-example": {
		hint: "例题演练：题干 + 解答步骤",
		placeholders: [{
			key: "question",
			label: "题干",
			kind: "body"
		}, {
			key: "solution",
			label: "解答步骤",
			kind: "bullet"
		}]
	},
	"edu-summary": {
		hint: "课堂小结：要点归纳 + 导图",
		placeholders: [{
			key: "points",
			label: "要点归纳",
			kind: "bullet"
		}, {
			key: "mindmap",
			label: "思维导图占位",
			kind: "info-block"
		}]
	},
	"edu-homework": {
		hint: "作业布置：分层（基础/提高/拓展）",
		placeholders: [
			{
				key: "basic",
				label: "基础",
				kind: "bullet"
			},
			{
				key: "improve",
				label: "提高",
				kind: "bullet"
			},
			{
				key: "expand",
				label: "拓展",
				kind: "bullet"
			}
		]
	}
};
var SK_MID_BASE = {
	"edu-cover": {
		hint: "封面：课题+年级学科教师信息块",
		placeholders: [{
			key: "title",
			label: "课题名称",
			kind: "title"
		}, {
			key: "info",
			label: "年级 / 学科 / 教师",
			kind: "info-block"
		}]
	},
	"edu-goal": {
		hint: "教学目标：三维目标 + 考点对接",
		placeholders: [
			{
				key: "knowledge",
				label: "知识与技能",
				kind: "bullet"
			},
			{
				key: "process",
				label: "过程与方法",
				kind: "bullet"
			},
			{
				key: "emotion",
				label: "情感态度价值观",
				kind: "bullet"
			},
			{
				key: "exam",
				label: "考点对接",
				kind: "info-block"
			}
		]
	},
	"edu-explain": {
		hint: "知识讲解：定义 + 推导 + 要点",
		placeholders: [
			{
				key: "definition",
				label: "概念/公式",
				kind: "body"
			},
			{
				key: "derive",
				label: "推导过程",
				kind: "bullet"
			},
			{
				key: "points",
				label: "要点展开",
				kind: "bullet"
			}
		]
	},
	"edu-example": {
		hint: "例题演练：题干 + 思路 + 解答",
		placeholders: [
			{
				key: "question",
				label: "题干",
				kind: "body"
			},
			{
				key: "thinking",
				label: "解题思路",
				kind: "bullet"
			},
			{
				key: "solution",
				label: "解答步骤",
				kind: "bullet"
			}
		]
	},
	"edu-summary": {
		hint: "课堂小结：要点 + 知识网",
		placeholders: [{
			key: "points",
			label: "要点归纳",
			kind: "bullet"
		}, {
			key: "mindmap",
			label: "知识网络占位",
			kind: "info-block"
		}]
	},
	"edu-homework": {
		hint: "作业布置：分层（基础/提高/拓展/探究）",
		placeholders: [
			{
				key: "basic",
				label: "基础",
				kind: "bullet"
			},
			{
				key: "improve",
				label: "提高",
				kind: "bullet"
			},
			{
				key: "expand",
				label: "拓展",
				kind: "bullet"
			},
			{
				key: "probe",
				label: "探究",
				kind: "bullet"
			}
		]
	}
};
var SK_HIGH_BASE = {
	"edu-cover": {
		hint: "封面：课题+年级学科教师信息块",
		placeholders: [{
			key: "title",
			label: "课题名称",
			kind: "title"
		}, {
			key: "info",
			label: "年级 / 学科 / 教师",
			kind: "info-block"
		}]
	},
	"edu-goal": {
		hint: "教学目标：素养目标 + 考点",
		placeholders: [{
			key: "literacy",
			label: "学科素养",
			kind: "bullet"
		}, {
			key: "exam",
			label: "考点对接",
			kind: "info-block"
		}]
	},
	"edu-explain": {
		hint: "知识讲解：定理 + 推导链 + 变式",
		placeholders: [
			{
				key: "theorem",
				label: "定理/公式",
				kind: "body"
			},
			{
				key: "derive",
				label: "推导链",
				kind: "bullet"
			},
			{
				key: "variant",
				label: "变式要点",
				kind: "bullet"
			}
		]
	},
	"edu-example": {
		hint: "例题演练：题干 + 多解 + 规范",
		placeholders: [
			{
				key: "question",
				label: "题干",
				kind: "body"
			},
			{
				key: "solutions",
				label: "多解思路",
				kind: "bullet"
			},
			{
				key: "standard",
				label: "规范解答",
				kind: "bullet"
			}
		]
	},
	"edu-summary": {
		hint: "课堂小结：能力提炼 + 网络",
		placeholders: [{
			key: "points",
			label: "能力提炼",
			kind: "bullet"
		}, {
			key: "mindmap",
			label: "知识网络占位",
			kind: "info-block"
		}]
	},
	"edu-homework": {
		hint: "作业布置：分层（基础/综合/拔高）",
		placeholders: [
			{
				key: "basic",
				label: "基础",
				kind: "bullet"
			},
			{
				key: "synthesis",
				label: "综合",
				kind: "bullet"
			},
			{
				key: "advanced",
				label: "拔高",
				kind: "bullet"
			}
		]
	}
};
function withSubjectTweak(base, subject) {
	const fam = subjectFamily(subject);
	if (subject === "语文") return {
		...base,
		"edu-explain": {
			hint: "文本讲解：段落大意 + 赏析",
			placeholders: [{
				key: "paragraph",
				label: "段落大意",
				kind: "body"
			}, {
				key: "appreciate",
				label: "语言赏析",
				kind: "bullet"
			}]
		}
	};
	if (subject === "数学") return {
		...base,
		"edu-explain": {
			hint: "知识讲解：公式 + 推导 + 应用",
			placeholders: [
				{
					key: "formula",
					label: "公式/定理",
					kind: "body"
				},
				{
					key: "derive",
					label: "推导过程",
					kind: "bullet"
				},
				{
					key: "apply",
					label: "应用举例",
					kind: "bullet"
				}
			]
		}
	};
	if (subject === "英语") return {
		...base,
		"edu-explain": {
			hint: "情境讲解：句型 + 情境",
			placeholders: [
				{
					key: "pattern",
					label: "重点句型",
					kind: "body"
				},
				{
					key: "scene",
					label: "情境示例",
					kind: "info-block"
				},
				{
					key: "points",
					label: "要点展开",
					kind: "bullet"
				}
			]
		}
	};
	if (fam === "science") return {
		...base,
		"edu-explain": {
			hint: "知识讲解：概念 + 原理",
			placeholders: [{
				key: "concept",
				label: "核心概念",
				kind: "body"
			}, {
				key: "principle",
				label: "科学原理",
				kind: "bullet"
			}]
		},
		"edu-example": {
			hint: "实验/例题：步骤 + 现象",
			placeholders: [
				{
					key: "question",
					label: "问题/课题",
					kind: "body"
				},
				{
					key: "steps",
					label: "实验步骤",
					kind: "bullet"
				},
				{
					key: "phenomenon",
					label: "现象/结论",
					kind: "bullet"
				}
			]
		}
	};
	if (fam === "humanity") return {
		...base,
		"edu-explain": {
			hint: "知识讲解：脉络 + 史料",
			placeholders: [
				{
					key: "context",
					label: "时代背景",
					kind: "body"
				},
				{
					key: "clue",
					label: "发展脉络",
					kind: "bullet"
				},
				{
					key: "evidence",
					label: "史料/案例",
					kind: "info-block"
				}
			]
		}
	};
	return base;
}
var STAGE_SKELETONS = {
	lower: {
		_default: SK_LOW_BASE,
		语文: withSubjectTweak(SK_LOW_BASE, "语文"),
		数学: withSubjectTweak(SK_LOW_BASE, "数学"),
		英语: withSubjectTweak(SK_LOW_BASE, "英语"),
		science: withSubjectTweak(SK_LOW_BASE, "science"),
		humanity: withSubjectTweak(SK_LOW_BASE, "humanity")
	},
	upper: {
		_default: SK_UP_BASE,
		语文: withSubjectTweak(SK_UP_BASE, "语文"),
		数学: withSubjectTweak(SK_UP_BASE, "数学"),
		英语: withSubjectTweak(SK_UP_BASE, "英语"),
		science: withSubjectTweak(SK_UP_BASE, "science"),
		humanity: withSubjectTweak(SK_UP_BASE, "humanity")
	},
	middle: {
		_default: SK_MID_BASE,
		语文: withSubjectTweak(SK_MID_BASE, "语文"),
		数学: withSubjectTweak(SK_MID_BASE, "数学"),
		英语: withSubjectTweak(SK_MID_BASE, "英语"),
		science: withSubjectTweak(SK_MID_BASE, "science"),
		humanity: withSubjectTweak(SK_MID_BASE, "humanity")
	},
	high: {
		_default: SK_HIGH_BASE,
		语文: withSubjectTweak(SK_HIGH_BASE, "语文"),
		数学: withSubjectTweak(SK_HIGH_BASE, "数学"),
		英语: withSubjectTweak(SK_HIGH_BASE, "英语"),
		science: withSubjectTweak(SK_HIGH_BASE, "science"),
		humanity: withSubjectTweak(SK_HIGH_BASE, "humanity")
	}
};
function skeletonFor(stage, subject) {
	const stageMap = STAGE_SKELETONS[stage];
	const base = stageMap[subjectKey(subject)] ?? stageMap._default ?? EDU_LAYOUT_SKELETONS;
	const merged = {};
	for (const layout of Object.keys(base)) {
		const sk = base[layout];
		const geo = EDU_LAYOUT_SKELETONS[layout];
		merged[layout] = {
			hint: sk?.hint ?? geo?.hint,
			placeholders: (sk?.placeholders ?? geo?.placeholders ?? []).map((p) => {
				const g = geo?.placeholders.find((x) => x.key === p.key);
				return g ? {
					...g,
					...p,
					rect: g.rect
				} : p;
			})
		};
	}
	return merged;
}
function getSkeleton(layout, opts) {
	if (opts?.tplLayouts && opts.tplLayouts[layout]) return opts.tplLayouts[layout];
	const sk = skeletonFor(opts?.stage ?? "upper", opts?.subject ?? "_default")[layout];
	if (sk) return sk;
	return EDU_LAYOUT_SKELETONS[layout];
}
var PLAIN_LAYOUTS = [
	"title-body",
	"title-only",
	"two-col",
	"blank"
];
function isStructuredLayout(layout) {
	if (!layout) return false;
	if (PLAIN_LAYOUTS.includes(layout)) return false;
	return !!getSkeleton(layout);
}
function distributeToSlots(layout, bullets, opts) {
	const sk = getSkeleton(layout, opts);
	if (!sk) return {};
	const slots = {};
	let idx = 0;
	for (const p of sk.placeholders) {
		if (p.key === "title" && layout !== "cover") {
			slots[p.key] = [];
			continue;
		}
		if (p.kind === "bullet") {
			const n = Math.max(1, Math.ceil((bullets.length - idx) / remainingBulletCount(sk.placeholders, p)));
			let chunk = bullets.slice(idx, idx + n);
			if (p.columns && p.columns > 1) {
				const expanded = chunk.flatMap((line) => {
					const sub = line.split(/\n+/).map((x) => x.replace(/^[\s•\-*]+/, "").trim()).filter(Boolean);
					return sub.length > 1 ? sub : [line];
				});
				if (expanded.length >= p.columns) chunk = expanded;
			}
			slots[p.key] = chunk.length ? chunk : [];
			idx += n;
		} else {
			slots[p.key] = bullets[idx] !== void 0 ? [bullets[idx]] : [];
			idx += 1;
		}
	}
	if (idx < bullets.length) slots["__overflow"] = bullets.slice(idx);
	return slots;
}
function remainingBulletCount(phs, current) {
	let c = 0;
	let seen = false;
	for (const p of phs) {
		if (p === current) {
			seen = true;
			continue;
		}
		if (seen && p.kind === "bullet") c++;
	}
	return c + 1;
}
function eduDemoOutline() {
	return [
		{
			title: "封面",
			bullets: [
				"《课程标题》",
				"学科 · 年级 · 班级",
				"授课教师：XXX"
			],
			layout: "edu-cover",
			notes: ""
		},
		{
			title: "学习目标",
			bullets: [
				"知识点一：能理解并表述",
				"知识点二：能运用解决",
				"核心素养：培养探究能力"
			],
			layout: "edu-goal",
			notes: ""
		},
		{
			title: "情境导入",
			bullets: ["生活/旧知情境引出问题", "激发兴趣、明确学习任务"],
			layout: "title-body",
			notes: ""
		},
		{
			title: "新知讲解",
			bullets: [
				"核心概念与原理",
				"关键步骤与要点",
				"易错点提示"
			],
			layout: "edu-explain",
			notes: ""
		},
		{
			title: "例题精讲",
			bullets: [
				"典型例题呈现",
				"思路分析 + 分步解答",
				"方法归纳"
			],
			layout: "edu-example",
			notes: ""
		},
		{
			title: "课堂小结",
			bullets: ["本节课核心收获", "知识结构梳理"],
			layout: "edu-summary",
			notes: ""
		},
		{
			title: "课后作业",
			bullets: ["基础巩固练习", "拓展提升任务"],
			layout: "edu-homework",
			notes: ""
		}
	];
}
var DEMO_CHINA_CHINESE = [
	{
		title: "封面",
		bullets: [
			"《课题名称》",
			"年级 · 学科",
			"授课教师：XXX"
		],
		layout: "edu-cover",
		notes: "可配水墨/山水背景"
	},
	{
		title: "学习目标",
		bullets: [
			"语言建构：诵读积累，理解文意",
			"审美鉴赏：品味语言，赏析手法",
			"文化传承：体悟情感与文化自信"
		],
		layout: "edu-goal",
		notes: ""
	},
	{
		title: "作者与背景",
		bullets: ["作者简介（时代 / 生平 / 代表作）", "创作背景与社会语境"],
		layout: "edu-explain",
		notes: "结合史料或题解"
	},
	{
		title: "初读感知",
		bullets: ["朗读正音，读准字词", "整体感知，概括内容大意"],
		layout: "title-body",
		notes: ""
	},
	{
		title: "精读赏析",
		bullets: [
			"抓意象 / 关键词，品味语言",
			"名句赏析与手法探微",
			"情感脉络梳理"
		],
		layout: "edu-explain",
		notes: "可分组讨论重点句"
	},
	{
		title: "合作探究",
		bullets: ["探究问题：主题与现实意义", "小组分享，互评补充"],
		layout: "edu-example",
		notes: ""
	},
	{
		title: "拓展延伸",
		bullets: ["关联阅读 / 同题材作品", "文化链接与现实关照"],
		layout: "content-2col",
		notes: ""
	},
	{
		title: "课堂小结",
		bullets: ["核心收获梳理", "知识结构导图"],
		layout: "edu-summary",
		notes: ""
	},
	{
		title: "课后作业",
		bullets: ["基础：背诵 / 默写", "提升：练笔或短文评析"],
		layout: "edu-homework",
		notes: ""
	}
];
var DEMO_CARTOON_KINDER = [
	{
		title: "封面",
		bullets: [
			"课程《XXX》",
			"XX 班的小朋友们",
			"老师：XXX"
		],
		layout: "edu-cover",
		notes: "大图大字，童趣可爱"
	},
	{
		title: "今天的目标",
		bullets: [
			"认知：认识……",
			"能力：学会……",
			"情感：喜欢……"
		],
		layout: "edu-goal",
		notes: ""
	},
	{
		title: "情境导入",
		bullets: ["小动物（或绘本）故事引出", "激发兴趣，明确今天任务"],
		layout: "title-body",
		notes: ""
	},
	{
		title: "趣味认知",
		bullets: ["看一看：图片 / 实物认一认", "听一听：儿歌 / 故事"],
		layout: "edu-explain",
		notes: ""
	},
	{
		title: "游戏互动",
		bullets: ["一起来做游戏", "动手试一试"],
		layout: "edu-example",
		notes: "分组或集体游戏"
	},
	{
		title: "动动手",
		bullets: ["手工 / 绘画", "展示与分享"],
		layout: "content-2col",
		notes: ""
	},
	{
		title: "快乐小结",
		bullets: ["今天学会了什么", "给自己鼓鼓掌"],
		layout: "edu-summary",
		notes: ""
	},
	{
		title: "亲子小任务",
		bullets: ["和爸爸妈妈一起……", "拍照片分享"],
		layout: "edu-homework",
		notes: ""
	}
];
var SCENARIO_OUTLINES = {
	"china-chinese": DEMO_CHINA_CHINESE,
	"cartoon-kindergarten": DEMO_CARTOON_KINDER,
	"math-physics": [
		{
			title: "封面",
			bullets: [
				"《课题名称》",
				"年级 · 学科",
				"授课教师：XXX"
			],
			layout: "edu-cover",
			notes: "可配几何/公式背景"
		},
		{
			title: "学习目标",
			bullets: [
				"知识与技能：理解概念与规律",
				"过程与方法：经历探究与推导",
				"素养：建模与推理能力"
			],
			layout: "edu-goal",
			notes: ""
		},
		{
			title: "情境导入",
			bullets: ["生活中的现象 / 问题情境", "引出本节核心问题"],
			layout: "title-body",
			notes: ""
		},
		{
			title: "概念建构",
			bullets: ["核心概念与定义", "关键要素与条件"],
			layout: "edu-explain",
			notes: ""
		},
		{
			title: "公式与推导",
			bullets: [
				"核心公式呈现",
				"推导过程与思路",
				"适用条件与单位"
			],
			layout: "content-2col",
			notes: "板书推导步骤"
		},
		{
			title: "例题精讲",
			bullets: [
				"典型例题呈现",
				"审题 → 建模 → 求解",
				"易错点提示"
			],
			layout: "edu-example",
			notes: ""
		},
		{
			title: "课堂练习",
			bullets: ["变式训练", "分组板演与互评"],
			layout: "edu-explain",
			notes: ""
		},
		{
			title: "课堂小结",
			bullets: ["知识结构化梳理", "方法归纳"],
			layout: "edu-summary",
			notes: ""
		},
		{
			title: "课后作业",
			bullets: ["基础巩固", "拓展提升"],
			layout: "edu-homework",
			notes: ""
		}
	],
	"science-bio": [
		{
			title: "封面",
			bullets: [
				"《课题名称》",
				"年级 · 学科",
				"授课教师：XXX"
			],
			layout: "edu-cover",
			notes: "可配实验/自然背景"
		},
		{
			title: "学习目标",
			bullets: [
				"观察与描述现象",
				"理解原理与机制",
				"形成科学探究意识"
			],
			layout: "edu-goal",
			notes: ""
		},
		{
			title: "现象观察",
			bullets: ["呈现观察 / 实验现象", "提出待解决问题"],
			layout: "title-body",
			notes: ""
		},
		{
			title: "提出假设",
			bullets: ["基于现象作出猜想", "明确探究变量"],
			layout: "edu-explain",
			notes: ""
		},
		{
			title: "实验探究",
			bullets: [
				"方案设计与步骤",
				"操作要点与安全",
				"记录数据"
			],
			layout: "edu-example",
			notes: "演示/分组实验"
		},
		{
			title: "分析结论",
			bullets: ["处理数据 / 现象", "得出结论并验证假设"],
			layout: "content-2col",
			notes: ""
		},
		{
			title: "应用拓展",
			bullets: ["联系生活实际", "前沿或跨学科链接"],
			layout: "edu-explain",
			notes: ""
		},
		{
			title: "课堂小结",
			bullets: ["核心概念回顾", "探究方法提炼"],
			layout: "edu-summary",
			notes: ""
		},
		{
			title: "课后作业",
			bullets: ["观察记录", "探究小报告"],
			layout: "edu-homework",
			notes: ""
		}
	],
	"english": [
		{
			title: "封面",
			bullets: [
				"Unit / Lesson Title",
				"Grade · English",
				"Teacher: XXX"
			],
			layout: "edu-cover",
			notes: "可配情境插图"
		},
		{
			title: "Learning Goals",
			bullets: [
				"能听懂并说出目标语",
				"能读懂并运用结构",
				"乐于表达、跨文化意识"
			],
			layout: "edu-goal",
			notes: ""
		},
		{
			title: "Warm-up",
			bullets: ["歌曲 / 游戏 / 视频导入", "激活已知、铺垫话题"],
			layout: "title-body",
			notes: ""
		},
		{
			title: "Words & Expressions",
			bullets: ["目标词汇与短语", "发音与拼写操练"],
			layout: "edu-explain",
			notes: "图文配对"
		},
		{
			title: "Reading / Listening",
			bullets: ["语篇呈现与理解", "获取关键信息"],
			layout: "edu-example",
			notes: ""
		},
		{
			title: "Grammar Focus",
			bullets: ["目标句型 / 语法点", "归纳与例句"],
			layout: "content-2col",
			notes: ""
		},
		{
			title: "Output Task",
			bullets: ["Speaking / Writing 任务", "合作展示"],
			layout: "edu-explain",
			notes: "情景对话或写作"
		},
		{
			title: "Summary & Homework",
			bullets: ["本课小结", "听说读写作业"],
			layout: "edu-homework",
			notes: ""
		}
	],
	"history-politics": [
		{
			title: "封面",
			bullets: [
				"《课题名称》",
				"年级 · 学科",
				"授课教师：XXX"
			],
			layout: "edu-cover",
			notes: "可配史料/时间轴背景"
		},
		{
			title: "学习目标",
			bullets: [
				"了解基本史实",
				"理解因果与影响",
				"形成价值認识"
			],
			layout: "edu-goal",
			notes: ""
		},
		{
			title: "时代背景",
			bullets: ["社会环境与条件", "前因铺垫"],
			layout: "title-body",
			notes: ""
		},
		{
			title: "事件脉络",
			bullets: ["起因 → 经过 → 结果", "关键人物与节点"],
			layout: "edu-explain",
			notes: "配合时间轴"
		},
		{
			title: "分析探究",
			bullets: ["原因深度剖析", "历史/现实意义"],
			layout: "edu-example",
			notes: "史料实证"
		},
		{
			title: "史料实证",
			bullets: ["阅读材料 / 图片史料", "提取信息、论从史出"],
			layout: "content-2col",
			notes: ""
		},
		{
			title: "价值启示",
			bullets: ["经验与教训", "当代关照"],
			layout: "edu-explain",
			notes: ""
		},
		{
			title: "课堂小结",
			bullets: ["知识脉络梳理", "核心素养提升"],
			layout: "edu-summary",
			notes: ""
		},
		{
			title: "课后作业",
			bullets: ["梳理笔记", "小论文/思维导图"],
			layout: "edu-homework",
			notes: ""
		}
	],
	"art-pe": [
		{
			title: "封面",
			bullets: [
				"《课题名称》",
				"年级 · 学科",
				"授课教师：XXX"
			],
			layout: "edu-cover",
			notes: "可配作品/动作示范"
		},
		{
			title: "学习目标",
			bullets: [
				"感知与欣赏",
				"掌握技法 / 动作要领",
				"乐于表现与创造"
			],
			layout: "edu-goal",
			notes: ""
		},
		{
			title: "欣赏感知",
			bullets: ["名作 / 示范欣赏", "感受形式与情感"],
			layout: "title-body",
			notes: ""
		},
		{
			title: "技法解析",
			bullets: ["关键要领与步骤", "易错提醒"],
			layout: "edu-explain",
			notes: "示范演示"
		},
		{
			title: "实践创作",
			bullets: ["动手创作 / 动作练习", "巡回指导"],
			layout: "edu-example",
			notes: "分组实践"
		},
		{
			title: "展示评价",
			bullets: ["作品 / 成果展示", "自评互评"],
			layout: "content-2col",
			notes: ""
		},
		{
			title: "拓展延伸",
			bullets: ["生活中的应用", "名家/进阶赏析"],
			layout: "edu-explain",
			notes: ""
		},
		{
			title: "课堂小结",
			bullets: ["收获与体会", "审美/健康提升"],
			layout: "edu-summary",
			notes: ""
		}
	],
	"class-meeting": [
		{
			title: "封面",
			bullets: [
				"主题班会：《主题》",
				"班级 · 日期",
				"主持人：XXX"
			],
			layout: "edu-cover",
			notes: "可配励志/主题背景"
		},
		{
			title: "班会目标",
			bullets: ["明确主题意义", "达成共识与行动"],
			layout: "edu-goal",
			notes: ""
		},
		{
			title: "情境故事",
			bullets: ["案例 / 视频 / 身边事", "引发共鸣与思考"],
			layout: "title-body",
			notes: ""
		},
		{
			title: "讨论交流",
			bullets: ["分组讨论议题", "分享观点"],
			layout: "edu-example",
			notes: ""
		},
		{
			title: "行动倡议",
			bullets: ["拟定班级公约", "制定行动计划"],
			layout: "content-2col",
			notes: ""
		},
		{
			title: "践行展示",
			bullets: ["承诺签名 / 成果墙", "小组表态"],
			layout: "edu-explain",
			notes: ""
		},
		{
			title: "总结感悟",
			bullets: ["班主任寄语", "我的收获"],
			layout: "edu-summary",
			notes: ""
		}
	],
	"lecture-open": [
		{
			title: "封面",
			bullets: [
				"《课题名称》",
				"说课 / 公开课",
				"授课教师：XXX"
			],
			layout: "edu-cover",
			notes: ""
		},
		{
			title: "教材与学情",
			bullets: ["教材地位与作用", "学情分析"],
			layout: "edu-explain",
			notes: ""
		},
		{
			title: "教学目标",
			bullets: [
				"知识与能力",
				"过程与方法",
				"重难点突破"
			],
			layout: "edu-goal",
			notes: ""
		},
		{
			title: "教法学法",
			bullets: ["教法选择", "学法指导"],
			layout: "content-2col",
			notes: ""
		},
		{
			title: "教学过程",
			bullets: ["环节设计与意图", "师生活动安排"],
			layout: "edu-example",
			notes: ""
		},
		{
			title: "板书设计",
			bullets: ["结构化板书", "逻辑呈现"],
			layout: "edu-explain",
			notes: ""
		},
		{
			title: "教学反思",
			bullets: ["亮点与不足", "改进方向"],
			layout: "edu-summary",
			notes: ""
		}
	]
};
var SUBJECT_SCENARIO = {
	math: "math-physics",
	physics: "math-physics",
	chemistry: "math-physics",
	it: "math-physics",
	biology: "science-bio",
	science: "science-bio",
	geography: "science-bio",
	english: "english",
	history: "history-politics",
	politics: "history-politics",
	art: "art-pe",
	pe: "art-pe",
	chinese: "china-chinese"
};
function scenarioKeyFor(def) {
	const stage = def.tags?.find((t) => t.kind === "stage")?.value;
	const scenario = def.tags?.find((t) => t.kind === "scenario")?.value;
	const lowAge = def.style === "cartoon" || def.style === "fresh";
	if (lowAge && stage === "kindergarten") return "cartoon-kindergarten";
	if (lowAge && scenario === "class-meeting") return "class-meeting";
	for (const s of def.subjects ?? []) {
		const key = SUBJECT_SCENARIO[s];
		if (key) return key;
	}
	if (stage === "kindergarten") return "cartoon-kindergarten";
	if (scenario === "class-meeting") return "class-meeting";
	if (scenario === "lecture" || scenario === "open-class" || scenario === "training" || scenario === "review") return "lecture-open";
	if (def.style === "china") return "china-chinese";
}
function lookupScenarioOutline(def) {
	const key = scenarioKeyFor(def);
	return key ? SCENARIO_OUTLINES[key] : void 0;
}
function pptTemplate(id, def, kind = "ppt") {
	const th = getTheme(def.themeId);
	return {
		id,
		kind,
		name: def.name ?? `${th?.name ?? def.themeId}·${STYLE_LABELS[def.style]}课件`,
		style: def.style,
		tags: def.tags,
		colorFamily: def.colorFamily,
		themeId: def.themeId,
		layouts: { ...EDU_LAYOUT_SKELETONS },
		subjects: def.subjects,
		grades: def.grades,
		globalDecor: decorForScenario(def),
		demoOutline: def.demoOutline ?? lookupScenarioOutline(def) ?? eduDemoOutline()
	};
}
var t = (kind, value) => ({
	kind,
	value
});
var styles = (...v) => v.map((x) => t("style", x));
var stages = (...v) => v.map((x) => t("stage", x));
var subjects = (...v) => v.map((x) => t("subject", x));
var scenarios = (...v) => v.map((x) => t("scenario", x));
var pageTypes = (...v) => v.map((x) => t("pageType", x));
var PPT_TEMPLATE_DEFS = [
	{
		style: "china",
		themeId: "zgf-ink-wash",
		colorFamily: "mono",
		tags: [
			...styles("china"),
			...scenarios("general"),
			...stages("primary", "junior", "senior")
		]
	},
	{
		style: "china",
		themeId: "zgf-guochao",
		colorFamily: "red-gold",
		tags: [
			...styles("china"),
			...scenarios("class-meeting", "first-class"),
			...stages("primary", "junior")
		]
	},
	{
		style: "china",
		themeId: "zgf-shanshui",
		colorFamily: "cyan-green",
		tags: [
			...styles("china"),
			...scenarios("general"),
			...stages("junior", "senior")
		]
	},
	{
		style: "china",
		themeId: "zgf-song-qing",
		colorFamily: "cyan-green",
		tags: [
			...styles("china"),
			...subjects("chinese", "history"),
			...stages("junior", "senior")
		],
		demoOutline: DEMO_CHINA_CHINESE
	},
	{
		style: "minimal",
		themeId: "min-classic-blue",
		colorFamily: "blue",
		tags: [
			...styles("minimal"),
			...scenarios("lecture", "open-class"),
			...stages("junior", "senior")
		]
	},
	{
		style: "minimal",
		themeId: "min-geo",
		colorFamily: "gray",
		tags: [
			...styles("minimal"),
			...scenarios("general"),
			...stages("senior", "college")
		]
	},
	{
		style: "minimal",
		themeId: "min-gray-premium",
		colorFamily: "gray",
		tags: [
			...styles("minimal", "business"),
			...scenarios("training"),
			...stages("college")
		]
	},
	{
		style: "minimal",
		themeId: "min-pure-white",
		colorFamily: "gray",
		tags: [
			...styles("minimal"),
			...scenarios("general"),
			...stages("primary", "junior", "senior")
		]
	},
	{
		style: "minimal",
		themeId: "min-modern-line",
		colorFamily: "blue",
		tags: [
			...styles("minimal"),
			...scenarios("lecture"),
			...stages("junior", "senior")
		]
	},
	{
		style: "minimal",
		themeId: "min-navy-intellectual",
		colorFamily: "blue",
		tags: [
			...styles("minimal", "academic"),
			...subjects("math", "physics"),
			...stages("senior", "college")
		]
	},
	{
		style: "tech",
		themeId: "te-quantum-blue",
		colorFamily: "blue",
		tags: [
			...styles("tech"),
			...subjects("it", "physics"),
			...stages("junior", "senior", "college")
		]
	},
	{
		style: "tech",
		themeId: "te-tech-navy",
		colorFamily: "blue",
		tags: [
			...styles("tech"),
			...scenarios("open-class"),
			...stages("senior", "college")
		]
	},
	{
		style: "tech",
		themeId: "te-cyber-purple",
		colorFamily: "purple",
		tags: [
			...styles("tech"),
			...subjects("it"),
			...stages("junior", "senior")
		]
	},
	{
		style: "tech",
		themeId: "te-aurora-green",
		colorFamily: "cyan-green",
		tags: [
			...styles("tech"),
			...subjects("science", "biology"),
			...stages("junior", "senior")
		]
	},
	{
		style: "tech",
		themeId: "te-digital-cyan",
		colorFamily: "cyan-green",
		tags: [
			...styles("tech"),
			...scenarios("first-class"),
			...stages("primary", "junior")
		]
	},
	{
		style: "fresh",
		themeId: "fr-mint",
		colorFamily: "cyan-green",
		tags: [...styles("fresh"), ...stages("kindergarten", "primary")],
		demoOutline: DEMO_CARTOON_KINDER
	},
	{
		style: "fresh",
		themeId: "fr-sky-blue",
		colorFamily: "blue",
		tags: [
			...styles("fresh"),
			...scenarios("parents"),
			...stages("kindergarten", "primary")
		]
	},
	{
		style: "fresh",
		themeId: "fr-warm-orange",
		colorFamily: "warm",
		tags: [...styles("fresh"), ...stages("kindergarten", "primary")]
	},
	{
		style: "fresh",
		themeId: "fr-macaron-pink",
		colorFamily: "purple",
		tags: [
			...styles("fresh"),
			...subjects("art"),
			...stages("kindergarten", "primary")
		]
	},
	{
		style: "fresh",
		themeId: "fr-sakura",
		colorFamily: "warm",
		tags: [...styles("fresh"), ...stages("primary", "junior")]
	},
	{
		style: "academic",
		themeId: "aca-edu-blue",
		colorFamily: "blue",
		tags: [
			...styles("academic"),
			...scenarios("lecture", "review"),
			...stages("junior", "senior", "college")
		]
	},
	{
		style: "academic",
		themeId: "aca-rational",
		colorFamily: "gray",
		tags: [
			...styles("academic"),
			...subjects("math", "physics", "chemistry"),
			...stages("senior", "college")
		]
	},
	{
		style: "academic",
		themeId: "aca-deep-green",
		colorFamily: "cyan-green",
		tags: [
			...styles("academic"),
			...subjects("biology", "science"),
			...stages("junior", "senior")
		]
	},
	{
		style: "academic",
		themeId: "aca-cream",
		colorFamily: "warm",
		tags: [...styles("academic"), ...stages("primary", "junior")]
	},
	{
		style: "cartoon",
		themeId: "sp-cartoon",
		colorFamily: "gradient",
		tags: [
			...styles("cartoon"),
			...pageTypes("cover", "content"),
			...stages("kindergarten", "primary")
		]
	},
	{
		style: "cartoon",
		themeId: "sp-doodle",
		colorFamily: "gradient",
		tags: [
			...styles("cartoon"),
			...scenarios("class-meeting"),
			...pageTypes("content", "summary"),
			...stages("kindergarten", "primary")
		]
	},
	{
		style: "cartoon",
		themeId: "gr-orange-pink",
		colorFamily: "gradient",
		tags: [
			...styles("cartoon"),
			...subjects("art", "english"),
			...pageTypes("cover", "content", "homework"),
			...stages("kindergarten", "primary")
		]
	},
	{
		style: "cartoon",
		themeId: "fr-macaron-pink",
		colorFamily: "purple",
		tags: [
			...styles("cartoon"),
			...subjects("art"),
			...pageTypes("cover", "content"),
			...stages("kindergarten", "primary", "junior")
		]
	},
	{
		style: "cartoon",
		themeId: "fr-warm-orange",
		colorFamily: "warm",
		tags: [
			...styles("cartoon"),
			...scenarios("first-class"),
			...stages("kindergarten", "primary")
		]
	},
	{
		style: "cartoon",
		themeId: "gr-gold-orange",
		colorFamily: "warm",
		tags: [
			...styles("cartoon"),
			...subjects("pe", "art"),
			...stages("kindergarten", "primary", "junior")
		]
	},
	{
		style: "cartoon",
		themeId: "sp-party-red",
		colorFamily: "red-gold",
		tags: [
			...styles("cartoon"),
			...scenarios("class-meeting", "first-class"),
			...subjects("politics"),
			...stages("primary", "junior", "senior")
		]
	},
	{
		style: "cartoon",
		themeId: "sp-festive",
		colorFamily: "red-gold",
		tags: [
			...styles("cartoon"),
			...scenarios("class-meeting", "first-class"),
			...subjects("chinese", "politics", "english"),
			...stages("primary", "junior", "senior")
		]
	},
	{
		style: "china",
		themeId: "zgf-classic-red",
		colorFamily: "red-gold",
		tags: [
			...styles("china"),
			...scenarios("class-meeting", "first-class"),
			...subjects("chinese", "history", "politics"),
			...stages("junior", "senior")
		]
	},
	{
		style: "china",
		themeId: "zgf-guochao",
		colorFamily: "red-gold",
		tags: [
			...styles("china"),
			...scenarios("class-meeting"),
			...stages("primary", "junior")
		]
	},
	{
		style: "flat",
		themeId: "mo-haze-blue",
		colorFamily: "blue",
		tags: [...styles("flat"), ...stages("primary", "junior")]
	},
	{
		style: "flat",
		themeId: "mo-gray-purple",
		colorFamily: "purple",
		tags: [
			...styles("flat"),
			...subjects("art"),
			...stages("primary", "junior")
		]
	},
	{
		style: "flat",
		themeId: "mo-bean-green",
		colorFamily: "cyan-green",
		tags: [
			...styles("flat"),
			...subjects("science"),
			...stages("primary", "junior")
		]
	},
	{
		style: "business",
		themeId: "gr-blue-purple",
		colorFamily: "purple",
		tags: [
			...styles("business"),
			...scenarios("training", "parents"),
			...stages("college")
		]
	},
	{
		style: "business",
		themeId: "wa-elegant-purple",
		colorFamily: "purple",
		tags: [
			...styles("business"),
			...scenarios("open-class"),
			...stages("senior", "college")
		]
	},
	{
		style: "basic",
		themeId: "min-classic-blue",
		colorFamily: "blue",
		tags: [...styles("basic"), ...scenarios("general")]
	},
	{
		style: "basic",
		themeId: "min-pure-white",
		colorFamily: "gray",
		tags: [...styles("basic"), ...scenarios("general")]
	},
	{
		style: "basic",
		themeId: "aca-edu-blue",
		colorFamily: "blue",
		tags: [...styles("basic"), ...scenarios("general")]
	}
];
var H5_TEMPLATE_DEFS = [
	{
		style: "china",
		themeId: "zgf-guochao",
		colorFamily: "red-gold",
		tags: [
			...styles("china"),
			...scenarios("first-class", "class-meeting"),
			...stages("primary", "junior")
		]
	},
	{
		style: "china",
		themeId: "zgf-shanshui",
		colorFamily: "cyan-green",
		tags: [
			...styles("china"),
			...scenarios("general"),
			...stages("junior", "senior")
		]
	},
	{
		style: "china",
		themeId: "zgf-song-qing",
		colorFamily: "cyan-green",
		tags: [
			...styles("china"),
			...subjects("chinese", "history"),
			...stages("junior", "senior")
		]
	},
	{
		style: "minimal",
		themeId: "min-pure-white",
		colorFamily: "gray",
		tags: [
			...styles("minimal"),
			...scenarios("general"),
			...stages("primary", "junior", "senior")
		]
	},
	{
		style: "minimal",
		themeId: "min-modern-line",
		colorFamily: "blue",
		tags: [
			...styles("minimal"),
			...scenarios("lecture"),
			...stages("junior", "senior")
		]
	},
	{
		style: "minimal",
		themeId: "min-navy-intellectual",
		colorFamily: "blue",
		tags: [
			...styles("minimal", "academic"),
			...subjects("math"),
			...stages("senior", "college")
		]
	},
	{
		style: "tech",
		themeId: "te-quantum-blue",
		colorFamily: "blue",
		tags: [
			...styles("tech"),
			...subjects("it", "physics"),
			...stages("junior", "senior", "college")
		]
	},
	{
		style: "tech",
		themeId: "te-aurora-green",
		colorFamily: "cyan-green",
		tags: [
			...styles("tech"),
			...subjects("science"),
			...stages("junior", "senior")
		]
	},
	{
		style: "tech",
		themeId: "te-digital-cyan",
		colorFamily: "cyan-green",
		tags: [
			...styles("tech"),
			...scenarios("first-class"),
			...stages("primary", "junior")
		]
	},
	{
		style: "fresh",
		themeId: "fr-mint",
		colorFamily: "cyan-green",
		tags: [...styles("fresh"), ...stages("kindergarten", "primary")]
	},
	{
		style: "fresh",
		themeId: "fr-sky-blue",
		colorFamily: "blue",
		tags: [
			...styles("fresh"),
			...scenarios("parents"),
			...stages("kindergarten", "primary")
		]
	},
	{
		style: "fresh",
		themeId: "fr-warm-orange",
		colorFamily: "warm",
		tags: [...styles("fresh"), ...stages("kindergarten", "primary")]
	},
	{
		style: "fresh",
		themeId: "fr-macaron-pink",
		colorFamily: "purple",
		tags: [
			...styles("fresh"),
			...subjects("art"),
			...stages("kindergarten", "primary")
		]
	},
	{
		style: "fresh",
		themeId: "fr-sakura",
		colorFamily: "warm",
		tags: [...styles("fresh"), ...stages("primary", "junior")]
	},
	{
		style: "fresh",
		themeId: "fr-lemon",
		colorFamily: "gradient",
		tags: [...styles("fresh"), ...stages("kindergarten", "primary")]
	},
	{
		style: "academic",
		themeId: "aca-edu-blue",
		colorFamily: "blue",
		tags: [
			...styles("academic"),
			...scenarios("review"),
			...stages("junior", "senior", "college")
		]
	},
	{
		style: "academic",
		themeId: "aca-deep-green",
		colorFamily: "cyan-green",
		tags: [
			...styles("academic"),
			...subjects("biology"),
			...stages("junior", "senior")
		]
	},
	{
		style: "cartoon",
		themeId: "sp-cartoon",
		colorFamily: "gradient",
		tags: [
			...styles("cartoon"),
			...pageTypes("cover", "content"),
			...stages("kindergarten", "primary")
		]
	},
	{
		style: "cartoon",
		themeId: "sp-doodle",
		colorFamily: "gradient",
		tags: [
			...styles("cartoon"),
			...scenarios("class-meeting"),
			...pageTypes("content", "summary"),
			...stages("kindergarten", "primary")
		]
	},
	{
		style: "cartoon",
		themeId: "gr-orange-pink",
		colorFamily: "gradient",
		tags: [
			...styles("cartoon"),
			...subjects("art", "english"),
			...pageTypes("cover", "content", "homework"),
			...stages("kindergarten", "primary")
		]
	},
	{
		style: "cartoon",
		themeId: "fr-macaron-pink",
		colorFamily: "purple",
		tags: [
			...styles("cartoon"),
			...subjects("art"),
			...pageTypes("cover", "content"),
			...stages("kindergarten", "primary", "junior")
		]
	},
	{
		style: "cartoon",
		themeId: "fr-warm-orange",
		colorFamily: "warm",
		tags: [
			...styles("cartoon"),
			...scenarios("first-class"),
			...stages("kindergarten", "primary")
		]
	},
	{
		style: "cartoon",
		themeId: "gr-gold-orange",
		colorFamily: "warm",
		tags: [
			...styles("cartoon"),
			...subjects("pe", "art"),
			...stages("kindergarten", "primary", "junior")
		]
	},
	{
		style: "cartoon",
		themeId: "sp-party-red",
		colorFamily: "red-gold",
		tags: [
			...styles("cartoon"),
			...scenarios("first-class", "class-meeting"),
			...subjects("politics"),
			...stages("kindergarten", "primary", "junior", "senior")
		]
	},
	{
		style: "cartoon",
		themeId: "sp-festive",
		colorFamily: "red-gold",
		tags: [
			...styles("cartoon"),
			...scenarios("class-meeting", "first-class"),
			...subjects("chinese", "politics", "english"),
			...stages("primary", "junior", "senior")
		]
	},
	{
		style: "china",
		themeId: "zgf-classic-red",
		colorFamily: "red-gold",
		tags: [
			...styles("china"),
			...scenarios("class-meeting", "first-class"),
			...subjects("chinese", "history", "politics"),
			...stages("junior", "senior")
		]
	},
	{
		style: "china",
		themeId: "zgf-guochao",
		colorFamily: "red-gold",
		tags: [
			...styles("china"),
			...scenarios("class-meeting"),
			...stages("primary", "junior")
		]
	},
	{
		style: "flat",
		themeId: "mo-haze-blue",
		colorFamily: "blue",
		tags: [...styles("flat"), ...stages("primary", "junior")]
	},
	{
		style: "flat",
		themeId: "mo-gray-purple",
		colorFamily: "purple",
		tags: [
			...styles("flat"),
			...subjects("art"),
			...stages("primary", "junior")
		]
	},
	{
		style: "flat",
		themeId: "mo-bean-green",
		colorFamily: "cyan-green",
		tags: [
			...styles("flat"),
			...subjects("science"),
			...stages("primary", "junior")
		]
	},
	{
		style: "flat",
		themeId: "mo-rose-gray",
		colorFamily: "purple",
		tags: [...styles("flat"), ...stages("primary", "junior")]
	},
	{
		style: "business",
		themeId: "gr-blue-purple",
		colorFamily: "purple",
		tags: [
			...styles("business"),
			...scenarios("training"),
			...stages("college")
		]
	},
	{
		style: "business",
		themeId: "wa-elegant-purple",
		colorFamily: "purple",
		tags: [
			...styles("business"),
			...scenarios("open-class"),
			...stages("senior", "college")
		]
	},
	{
		style: "basic",
		themeId: "min-pure-white",
		colorFamily: "gray",
		tags: [...styles("basic"), ...scenarios("general")]
	},
	{
		style: "basic",
		themeId: "aca-edu-blue",
		colorFamily: "blue",
		tags: [...styles("basic"), ...scenarios("general")]
	}
];
function svgDataUrl(svg) {
	return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
var STYLE_DECOR_MAP = {
	china: [{
		assetId: "decor-china-seal",
		name: "国风印章",
		snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect x="6" y="6" width="52" height="52" rx="8" fill="none" stroke="#B5121B" stroke-width="3"/><text x="32" y="42" font-size="28" text-anchor="middle" fill="#B5121B" font-family="serif">印</text></svg>`) },
		slot: "corner"
	}, {
		assetId: "decor-china-bamboo",
		name: "国风竹枝",
		snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40" viewBox="0 0 80 40"><g stroke="#1E5631" stroke-width="2" fill="none"><path d="M12 40 Q14 20 10 4"/><path d="M12 14 Q22 16 20 6"/><path d="M12 24 Q20 22 22 30"/><path d="M28 40 Q30 22 26 8"/><path d="M28 18 Q36 20 34 10"/><path d="M28 26 Q36 24 38 32"/></g></svg>`) },
		slot: "floating"
	}],
	minimal: [{
		assetId: "decor-minimal-line",
		name: "素净同心圆",
		snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="none" stroke="#9AA0A6" stroke-width="2"/><circle cx="32" cy="32" r="18" fill="none" stroke="#9AA0A6" stroke-width="1"/></svg>`) },
		slot: "corner"
	}, {
		assetId: "decor-minimal-dot",
		name: "素净圆点",
		snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="5" fill="#C0C4C8"/></svg>`) },
		slot: "floating"
	}],
	tech: [{
		assetId: "decor-tech-hex",
		name: "科技六边形",
		snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><polygon points="32,6 56,20 56,44 32,58 8,44 8,20" fill="none" stroke="#02A7F0" stroke-width="2.5"/><circle cx="32" cy="32" r="6" fill="#02A7F0"/></svg>`) },
		slot: "corner"
	}, {
		assetId: "decor-tech-grid",
		name: "科技网格",
		snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><g stroke="#7FB8E6" stroke-width="1" fill="none"><path d="M0 20 H60 M0 40 H60 M20 0 V60 M40 0 V60"/></g></svg>`) },
		slot: "floating"
	}],
	fresh: [{
		assetId: "decor-fresh-leaf",
		name: "清新叶子",
		snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><path d="M32 56 C10 44 8 16 28 8 C52 2 58 30 32 56 Z" fill="#8FD3B6"/><path d="M28 12 C40 18 40 34 28 48" stroke="#1E5631" stroke-width="2" fill="none"/></svg>`) },
		slot: "corner"
	}, {
		assetId: "decor-fresh-leaf-sm",
		name: "清新小叶",
		snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><path d="M20 36 C8 28 6 12 18 6 C32 2 36 22 20 36 Z" fill="#A8D8C0"/></svg>`) },
		slot: "floating"
	}],
	academic: [{
		assetId: "decor-aca-rule",
		name: "严谨斜线",
		snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><line x1="8" y1="56" x2="56" y2="8" stroke="#1F4E79" stroke-width="3"/><line x1="16" y1="56" x2="56" y2="16" stroke="#1F4E79" stroke-width="1.5"/><line x1="8" y1="48" x2="48" y2="8" stroke="#1F4E79" stroke-width="1.5"/></svg>`) },
		slot: "corner"
	}, {
		assetId: "decor-aca-line",
		name: "严谨横线",
		snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="60" height="10" viewBox="0 0 60 10"><rect x="0" y="3" width="60" height="4" fill="#1F4E79"/></svg>`) },
		slot: "floating"
	}],
	cartoon: [{
		assetId: "decor-cartoon-sun",
		name: "卡通太阳",
		snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="16" fill="#FFB020"/><g stroke="#FFB020" stroke-width="3" stroke-linecap="round"><line x1="32" y1="6" x2="32" y2="14"/><line x1="32" y1="50" x2="32" y2="58"/><line x1="6" y1="32" x2="14" y2="32"/><line x1="50" y1="32" x2="58" y2="32"/><line x1="13" y1="13" x2="19" y2="19"/><line x1="45" y1="45" x2="51" y2="51"/><line x1="13" y1="51" x2="19" y2="45"/><line x1="45" y1="19" x2="51" y2="13"/></g></svg>`) },
		slot: "corner"
	}, {
		assetId: "decor-cartoon-star",
		name: "卡通星星",
		snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><polygon points="20,4 24,15 36,15 26,22 30,34 20,27 10,34 14,22 4,15 16,15" fill="#FFC53D"/></svg>`) },
		slot: "floating"
	}],
	flat: [{
		assetId: "decor-flat-circle",
		name: "扁平双圆",
		snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="20" cy="44" r="14" fill="#E8EAF0"/><circle cx="44" cy="20" r="10" fill="#D0D5DD"/></svg>`) },
		slot: "corner"
	}, {
		assetId: "decor-flat-dot",
		name: "扁平圆点组",
		snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="12" cy="28" r="7" fill="#E8EAF0"/><circle cx="28" cy="12" r="5" fill="#C8CDD6"/></svg>`) },
		slot: "floating"
	}],
	business: [{
		assetId: "decor-biz-line",
		name: "沉稳边框",
		snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect x="10" y="18" width="44" height="34" fill="none" stroke="#4A4A4A" stroke-width="2.5"/><line x1="10" y1="28" x2="54" y2="28" stroke="#4A4A4A" stroke-width="1.5"/></svg>`) },
		slot: "corner"
	}, {
		assetId: "decor-biz-bar",
		name: "沉稳色块条",
		snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="60" height="8" viewBox="0 0 60 8"><rect x="0" y="0" width="60" height="8" fill="#4A4A4A"/></svg>`) },
		slot: "floating"
	}],
	basic: [{
		assetId: "decor-basic-corner",
		name: "通用角标",
		snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><path d="M4 60 L60 60 L60 4" fill="none" stroke="#B0B6BD" stroke-width="3"/></svg>`) },
		slot: "corner"
	}, {
		assetId: "decor-basic-dot",
		name: "通用圆点",
		snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="4" fill="#B0B6BD"/></svg>`) },
		slot: "floating"
	}]
};
function decorForStyle(style) {
	return STYLE_DECOR_MAP[style] || STYLE_DECOR_MAP.basic;
}
var SCENARIO_DECOR_MAP = {
	"china-chinese": [{
		assetId: "decor-china-brush",
		name: "国风毛笔",
		snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect x="10" y="6" width="44" height="9" rx="3" fill="#7A1F1F"/><path d="M28 15 L36 15 L33 50 Z" fill="#3A2A1A"/><path d="M31 50 Q33 60 35 50 Q33 55 31 50 Z" fill="#1C1C1C"/><circle cx="14" cy="54" r="3" fill="#1E5631"/></svg>`) },
		slot: "corner"
	}, {
		assetId: "decor-china-cloud",
		name: "国风卷云",
		snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40" viewBox="0 0 80 40"><path d="M8 28 Q8 16 20 16 Q24 8 34 12 Q44 8 46 18 Q58 16 58 26 Q58 32 48 32 L16 32 Q8 32 8 28 Z" fill="none" stroke="#B5121B" stroke-width="2"/></svg>`) },
		slot: "floating"
	}],
	"cartoon-kindergarten": [{
		assetId: "decor-kinder-bear",
		name: "卡通小熊",
		snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="34" r="20" fill="#F4A261"/><circle cx="22" cy="18" r="6" fill="#F4A261"/><circle cx="42" cy="18" r="6" fill="#F4A261"/><circle cx="25" cy="32" r="3" fill="#3A2A1A"/><circle cx="39" cy="32" r="3" fill="#3A2A1A"/><ellipse cx="32" cy="40" rx="5" ry="4" fill="#3A2A1A"/></svg>`) },
		slot: "corner"
	}, {
		assetId: "decor-kinder-balloon",
		name: "卡通气球",
		snapshot: { url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48"><ellipse cx="20" cy="16" rx="13" ry="15" fill="#FF6B9D"/><path d="M20 31 L20 40" stroke="#FF6B9D" stroke-width="1.5"/><path d="M16 40 L24 40 L20 45 Z" fill="#FF6B9D"/></svg>`) },
		slot: "floating"
	}]
};
function decorForScenario(def) {
	const key = scenarioKeyFor(def);
	if (key && SCENARIO_DECOR_MAP[key]) return SCENARIO_DECOR_MAP[key];
	return decorForStyle(def.style);
}
function buildTemplates(kind, defs) {
	return defs.map((def, i) => pptTemplate(`${kind}-${def.style}-${i + 1}`, def, kind));
}
buildTemplates("ppt", PPT_TEMPLATE_DEFS);
buildTemplates("h5", H5_TEMPLATE_DEFS);
function makeBasicTemplate(kind = "ppt") {
	return {
		id: `basic-${kind}`,
		kind,
		name: "通用结构",
		style: "basic",
		themeId: "min-classic-blue",
		layouts: { ...EDU_LAYOUT_SKELETONS },
		demoOutline: eduDemoOutline()
	};
}
makeBasicTemplate("ppt");
//#endregion
//#region src/lib/exportPptx.ts
var VISUAL_TYPES = [
	"sequence",
	"compare-table",
	"timeline",
	"char-card",
	"compare-card",
	"quote",
	"diagram",
	"icon-card",
	"structure",
	"flow",
	"annotate"
];
/** 可视化组件白名单校验（与 isValidComponent 同构，防止非法对象静默丢失） */
function isValidVisual(v) {
	if (!v || typeof v !== "object" || typeof v.type !== "string") return false;
	if (!VISUAL_TYPES.includes(v.type)) return false;
	switch (v.type) {
		case "sequence": return Array.isArray(v.items) && v.items.length > 0;
		case "compare-table": return Array.isArray(v.cols) && Array.isArray(v.rows) && v.rows.length > 0;
		case "timeline": return Array.isArray(v.nodes) && v.nodes.length > 0;
		case "char-card": return Array.isArray(v.chars) && v.chars.length > 0;
		case "compare-card": return Array.isArray(v.pairs) && v.pairs.length > 0;
		case "quote": return typeof v.text === "string" && v.text.length > 0;
		case "diagram": return typeof v.center === "string" && Array.isArray(v.branches) && v.branches.length > 0;
		case "icon-card": return Array.isArray(v.items) && v.items.length > 0;
		case "structure": return Array.isArray(v.levels) && v.levels.length > 0;
		case "flow": return Array.isArray(v.steps) && v.steps.length > 0;
		case "annotate": return typeof v.text === "string" && v.text.length > 0;
		default: return false;
	}
}
function normalizeVisuals(v) {
	if (!v) return [];
	return Array.isArray(v) ? v.filter(isValidVisual) : isValidVisual(v) ? [v] : [];
}
/** 互动组件白名单校验（防止残缺/非法对象静默丢失互动） */
function isValidComponent(it) {
	if (!it || typeof it !== "object" || typeof it.type !== "string") return false;
	if (![
		"reveal",
		"quiz",
		"audio",
		"video",
		"gallery",
		"popup",
		"readalong"
	].includes(it.type)) return false;
	switch (it.type) {
		case "reveal": return typeof it.answer === "string";
		case "quiz": return typeof it.question === "string" && Array.isArray(it.options) && typeof it.correct === "number";
		case "audio": return typeof it.src === "string";
		case "video": return typeof it.src === "string";
		case "gallery": return Array.isArray(it.images);
		case "popup": return typeof it.triggerText === "string" && typeof it.content === "string";
		case "readalong": return Array.isArray(it.sentences);
		default: return false;
	}
}
/** 将互动组件累积进提纲页（兼容已有数组/单值/空），供 markdownToOutline 解析明文互动注释使用 */
function pushInteractive(cur, comp) {
	if (!cur) return;
	cur.interactive = Array.isArray(cur.interactive) ? [...cur.interactive, comp] : cur.interactive ? [cur.interactive, comp] : comp;
}
/** 从课件 Markdown 解析为可编辑提纲（按 ## 分节，每段作为一条要点） */
function markdownToOutline(md) {
	const slides = [];
	let cur = null;
	let sceneMode = false;
	const keepLine = (s, ln) => {
		if (!s) return;
		s.keepRaw = s.keepRaw ? [...s.keepRaw, ln] : [ln];
	};
	for (const raw of md.split("\n")) {
		const line = raw.trim();
		if (!line) continue;
		const elMatch = line.match(/^<!--\s*CW-EL:([A-Za-z0-9+/=]+)\s*-->$/);
		if (elMatch && cur) {
			const els = b64dec(elMatch[1]);
			if (els) cur.elements = els;
			continue;
		}
		const itMatch = line.match(/^<!--\s*CW-IT:([A-Za-z0-9+/=]+)\s*-->$/);
		if (itMatch && cur) {
			const it = b64dec(itMatch[1]);
			if (it && isValidComponent(it)) cur.interactive = Array.isArray(cur.interactive) ? [...cur.interactive, it] : cur.interactive ? [cur.interactive, it] : it;
			continue;
		}
		const visMatch = line.match(/^<!--\s*VISUAL:([A-Za-z0-9+/=]+)\s*-->$/);
		if (visMatch && cur) {
			const v = b64dec(visMatch[1]);
			if (v && isValidVisual(v)) cur.visuals = Array.isArray(cur.visuals) ? [...cur.visuals, v] : cur.visuals ? [cur.visuals, v] : v;
			continue;
		}
		if (line.match(/^#\s+/) && !cur) continue;
		if (!cur && line.startsWith(">")) continue;
		const cm = line.match(/^<!--\s*(\w+)\s*:\s*(.*?)\s*-->\s*$/i);
		if (cm && cur) {
			const kw = cm[1].toLowerCase();
			const val = cm[2];
			if (kw === "layout") {
				cur.layout = val.trim();
				sceneMode = (cur.layout || "").startsWith("scene");
				continue;
			}
			if (sceneMode) {
				keepLine(cur, line);
				continue;
			}
			if (kw === "quiz") {
				const parts = val.split(/(?<!\\)\|/).map((s) => s.replace(/\\\|/g, "|").trim()).filter(Boolean);
				if (parts.length >= 3) {
					const correct = parseInt(parts[parts.length - 1], 10);
					if (!isNaN(correct)) pushInteractive(cur, {
						type: "quiz",
						question: parts[0],
						options: parts.slice(1, parts.length - 1),
						correct
					});
				}
				continue;
			}
			if (kw === "readalong") {
				const parts = val.split(/(?<!\\)\|/).map((s) => s.replace(/\\\|/g, "|").trim()).filter(Boolean);
				if (parts.length) pushInteractive(cur, {
					type: "readalong",
					sentences: parts.map((t) => ({
						text: t,
						src: ""
					}))
				});
				continue;
			}
			if (kw === "reveal") {
				const seg = val.split("=>");
				pushInteractive(cur, {
					type: "reveal",
					prompt: (seg[0] || "").trim(),
					answer: (seg[1] || "").trim()
				});
				continue;
			}
			if (kw === "draw") {
				pushInteractive(cur, {
					type: "drawing",
					title: val.trim(),
					prompt: ""
				});
				continue;
			}
			keepLine(cur, line);
			continue;
		}
		if (sceneMode && cur) {
			keepLine(cur, line);
			continue;
		}
		if (line.startsWith("## ")) {
			if (cur) {
				flushSlide(cur);
				slides.push(cur);
			}
			cur = {
				title: line.slice(3).trim(),
				bullets: []
			};
			sceneMode = false;
		} else if (cur) cur.bullets.push(line.replace(/^[-*]\s*/, "").replace(/^#{1,2}\s*/, "").replace(/\*{1,3}/g, "").replace(/`/g, ""));
		else cur = {
			title: "课件",
			bullets: [line.replace(/^[-*]\s*/, "").replace(/^#{1,2}\s*/, "")]
		};
	}
	if (cur) {
		flushSlide(cur);
		slides.push(cur);
	}
	return slides;
}
function flushSlide(s) {
	if (s.slots) return;
	if (!s.layout && s.bullets.length >= 2) s.layout = pickContentLayout(s.bullets.length);
	if (isStructuredLayout(s.layout)) {
		const dist = distributeToSlots(s.layout, s.bullets);
		if (Object.keys(dist).length) s.slots = dist;
	}
}
/** 将可编辑提纲转回 Markdown（供 Word / PDF 导出与素材库保存，与 PPT 同步） */
function outlineToMarkdown(outline, opts) {
	const lines = [
		`# ${opts.title}`,
		"",
		`> ${opts.subject} · ${opts.grade}`,
		""
	];
	outline.forEach((s) => {
		lines.push(`## ${s.title}`);
		if (s.layout) lines.push(`<!-- layout: ${s.layout} -->`);
		if (s.keepRaw && s.keepRaw.length) lines.push(...s.keepRaw);
		(s.elements && s.elements.length ? extractBullets(s.elements) : s.bullets).forEach((b) => lines.push(`- ${b}`));
		if (s.notes) lines.push("", `> 教师备注：${s.notes}`);
		if (s.elements && s.elements.length) lines.push(`<!-- CW-EL:${b64enc(s.elements)} -->`);
		if (s.interactive && isValidComponent(s.interactive)) lines.push(`<!-- CW-IT:${b64enc(s.interactive)} -->`);
		for (const v of normalizeVisuals(s.visuals)) lines.push(`<!-- VISUAL:${b64enc(v)} -->`);
		lines.push("");
	});
	return lines.join("\n");
}
/** 将任意对象 base64 化（UTF-8 安全），用于内嵌注释，规避特殊字符截断 */
function b64enc(x) {
	try {
		return btoa(unescape(encodeURIComponent(JSON.stringify(x))));
	} catch {
		return "";
	}
}
/** base64 还原（对应 b64enc）；失败返回 null 并上报 */
function b64dec(s) {
	try {
		return JSON.parse(decodeURIComponent(escape(atob(s))));
	} catch (e) {
		reportPersistError("CW-IT/CW-EL 解析失败", e);
		return null;
	}
}
/** 持久化解析失败上报（不静默吞，便于排查“保存后互动丢失”） */
function reportPersistError(msg, e) {
	if (typeof console !== "undefined") console.warn("[persist]", msg, e);
}
/** 从 elements 回提纯文本条目（用于发布/导出 doc/pdf 时写入 bullets） */
function extractBullets(elements) {
	if (!elements || !elements.length) return [];
	const out = [];
	elements.forEach((e) => {
		if (e.type !== "text" || !e.text) return;
		if (e.bullet) e.text.split("\n").forEach((line) => {
			if (line.trim()) out.push(line.trim());
		});
		else {
			const t = e.text.trim();
			if (t) out.push(t);
		}
	});
	return out;
}
//#endregion
export { markdownToOutline, outlineToMarkdown };
