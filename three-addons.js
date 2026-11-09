( function () {

	class GLTFLoader extends THREE.Loader {

		constructor( manager ) {

			super( manager );
			this.dracoLoader = null;
			this.ktx2Loader = null;
			this.meshoptDecoder = null;
			this.pluginCallbacks = [];
			this.register( function ( parser ) {

				return new GLTFMaterialsClearcoatExtension( parser );

			} );
			this.register( function ( parser ) {

				return new GLTFTextureBasisUExtension( parser );

			} );
			this.register( function ( parser ) {

				return new GLTFTextureWebPExtension( parser );

			} );
			this.register( function ( parser ) {

				return new GLTFMaterialsTransmissionExtension( parser );

			} );
			this.register( function ( parser ) {

				return new GLTFLightsExtension( parser );

			} );
			this.register( function ( parser ) {

				return new GLTFMeshoptCompression( parser );

			} );

		}

		load( url, onLoad, onProgress, onError ) {

			const scope = this;
			let resourcePath;

			if ( this.resourcePath !== '' ) {

				resourcePath = this.resourcePath;

			} else if ( this.path !== '' ) {

				resourcePath = this.path;

			} else {

				resourcePath = THREE.LoaderUtils.extractUrlBase( url );

			} // Tells the LoadingManager to track an extra item, which resolves after
			// the model is fully loaded. This means the count of items loaded will
			// be incorrect, but ensures manager.onLoad() does not fire early.


			this.manager.itemStart( url );

			const _onError = function ( e ) {

				if ( onError ) {

					onError( e );

				} else {

					console.error( e );

				}

				scope.manager.itemError( url );
				scope.manager.itemEnd( url );

			};

			const loader = new THREE.FileLoader( this.manager );
			loader.setPath( this.path );
			loader.setResponseType( 'arraybuffer' );
			loader.setRequestHeader( this.requestHeader );
			loader.setWithCredentials( this.withCredentials );
			loader.load( url, function ( data ) {

				try {

					scope.parse( data, resourcePath, function ( gltf ) {

						onLoad( gltf );
						scope.manager.itemEnd( url );

					}, _onError );

				} catch ( e ) {

					_onError( e );

				}

			}, onProgress, _onError );

		}

		setDRACOLoader( dracoLoader ) {

			this.dracoLoader = dracoLoader;
			return this;

		}

		setDDSLoader() {

			throw new Error( 'THREE.GLTFLoader: "MSFT_texture_dds" no longer supported. Please update to "KHR_texture_basisu".' );

		}

		setKTX2Loader( ktx2Loader ) {

			this.ktx2Loader = ktx2Loader;
			return this;

		}

		setMeshoptDecoder( meshoptDecoder ) {

			this.meshoptDecoder = meshoptDecoder;
			return this;

		}

		register( callback ) {

			if ( this.pluginCallbacks.indexOf( callback ) === - 1 ) {

				this.pluginCallbacks.push( callback );

			}

			return this;

		}

		unregister( callback ) {

			if ( this.pluginCallbacks.indexOf( callback ) !== - 1 ) {

				this.pluginCallbacks.splice( this.pluginCallbacks.indexOf( callback ), 1 );

			}

			return this;

		}

		parse( data, path, onLoad, onError ) {

			let content;
			const extensions = {};
			const plugins = {};

			if ( typeof data === 'string' ) {

				content = data;

			} else {

				const magic = THREE.LoaderUtils.decodeText( new Uint8Array( data, 0, 4 ) );

				if ( magic === BINARY_EXTENSION_HEADER_MAGIC ) {

					try {

						extensions[ EXTENSIONS.KHR_BINARY_GLTF ] = new GLTFBinaryExtension( data );

					} catch ( error ) {

						if ( onError ) onError( error );
						return;

					}

					content = extensions[ EXTENSIONS.KHR_BINARY_GLTF ].content;

				} else {

					content = THREE.LoaderUtils.decodeText( new Uint8Array( data ) );

				}

			}

			const json = JSON.parse( content );

			if ( json.asset === undefined || json.asset.version[ 0 ] < 2 ) {

				if ( onError ) onError( new Error( 'THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported.' ) );
				return;

			}

			const parser = new GLTFParser( json, {
				path: path || this.resourcePath || '',
				crossOrigin: this.crossOrigin,
				requestHeader: this.requestHeader,
				manager: this.manager,
				ktx2Loader: this.ktx2Loader,
				meshoptDecoder: this.meshoptDecoder
			} );
			parser.fileLoader.setRequestHeader( this.requestHeader );

			for ( let i = 0; i < this.pluginCallbacks.length; i ++ ) {

				const plugin = this.pluginCallbacks[ i ]( parser );
				plugins[ plugin.name ] = plugin; // Workaround to avoid determining as unknown extension
				// in addUnknownExtensionsToUserData().
				// Remove this workaround if we move all the existing
				// extension handlers to plugin system

				extensions[ plugin.name ] = true;

			}

			if ( json.extensionsUsed ) {

				for ( let i = 0; i < json.extensionsUsed.length; ++ i ) {

					const extensionName = json.extensionsUsed[ i ];
					const extensionsRequired = json.extensionsRequired || [];

					switch ( extensionName ) {

						case EXTENSIONS.KHR_MATERIALS_UNLIT:
							extensions[ extensionName ] = new GLTFMaterialsUnlitExtension();
							break;

						case EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS:
							extensions[ extensionName ] = new GLTFMaterialsPbrSpecularGlossinessExtension();
							break;

						case EXTENSIONS.KHR_DRACO_MESH_COMPRESSION:
							extensions[ extensionName ] = new GLTFDracoMeshCompressionExtension( json, this.dracoLoader );
							break;

						case EXTENSIONS.KHR_TEXTURE_TRANSFORM:
							extensions[ extensionName ] = new GLTFTextureTransformExtension();
							break;

						case EXTENSIONS.KHR_MESH_QUANTIZATION:
							extensions[ extensionName ] = new GLTFMeshQuantizationExtension();
							break;

						default:
							if ( extensionsRequired.indexOf( extensionName ) >= 0 && plugins[ extensionName ] === undefined ) {

								console.warn( 'THREE.GLTFLoader: Unknown extension "' + extensionName + '".' );

							}

					}

				}

			}

			parser.setExtensions( extensions );
			parser.setPlugins( plugins );
			parser.parse( onLoad, onError );

		}

	}
	/* GLTFREGISTRY */


	function GLTFRegistry() {

		let objects = {};
		return {
			get: function ( key ) {

				return objects[ key ];

			},
			add: function ( key, object ) {

				objects[ key ] = object;

			},
			remove: function ( key ) {

				delete objects[ key ];

			},
			removeAll: function () {

				objects = {};

			}
		};

	}
	/*********************************/

	/********** EXTENSIONS ***********/

	/*********************************/


	const EXTENSIONS = {
		KHR_BINARY_GLTF: 'KHR_binary_glTF',
		KHR_DRACO_MESH_COMPRESSION: 'KHR_draco_mesh_compression',
		KHR_LIGHTS_PUNCTUAL: 'KHR_lights_punctual',
		KHR_MATERIALS_CLEARCOAT: 'KHR_materials_clearcoat',
		KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS: 'KHR_materials_pbrSpecularGlossiness',
		KHR_MATERIALS_TRANSMISSION: 'KHR_materials_transmission',
		KHR_MATERIALS_UNLIT: 'KHR_materials_unlit',
		KHR_TEXTURE_BASISU: 'KHR_texture_basisu',
		KHR_TEXTURE_TRANSFORM: 'KHR_texture_transform',
		KHR_MESH_QUANTIZATION: 'KHR_mesh_quantization',
		EXT_TEXTURE_WEBP: 'EXT_texture_webp',
		EXT_MESHOPT_COMPRESSION: 'EXT_meshopt_compression'
	};
	/**
	 * Punctual Lights Extension
	 *
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_lights_punctual
	 */

	class GLTFLightsExtension {

		constructor( parser ) {

			this.parser = parser;
			this.name = EXTENSIONS.KHR_LIGHTS_PUNCTUAL; // THREE.Object3D instance caches

			this.cache = {
				refs: {},
				uses: {}
			};

		}

		_markDefs() {

			const parser = this.parser;
			const nodeDefs = this.parser.json.nodes || [];

			for ( let nodeIndex = 0, nodeLength = nodeDefs.length; nodeIndex < nodeLength; nodeIndex ++ ) {

				const nodeDef = nodeDefs[ nodeIndex ];

				if ( nodeDef.extensions && nodeDef.extensions[ this.name ] && nodeDef.extensions[ this.name ].light !== undefined ) {

					parser._addNodeRef( this.cache, nodeDef.extensions[ this.name ].light );

				}

			}

		}

		_loadLight( lightIndex ) {

			const parser = this.parser;
			const cacheKey = 'light:' + lightIndex;
			let dependency = parser.cache.get( cacheKey );
			if ( dependency ) return dependency;
			const json = parser.json;
			const extensions = json.extensions && json.extensions[ this.name ] || {};
			const lightDefs = extensions.lights || [];
			const lightDef = lightDefs[ lightIndex ];
			let lightNode;
			const color = new THREE.Color( 0xffffff );
			if ( lightDef.color !== undefined ) color.fromArray( lightDef.color );
			const range = lightDef.range !== undefined ? lightDef.range : 0;

			switch ( lightDef.type ) {

				case 'directional':
					lightNode = new THREE.DirectionalLight( color );
					lightNode.target.position.set( 0, 0, - 1 );
					lightNode.add( lightNode.target );
					break;

				case 'point':
					lightNode = new THREE.PointLight( color );
					lightNode.distance = range;
					break;

				case 'spot':
					lightNode = new THREE.SpotLight( color );
					lightNode.distance = range; // Handle spotlight properties.

					lightDef.spot = lightDef.spot || {};
					lightDef.spot.innerConeAngle = lightDef.spot.innerConeAngle !== undefined ? lightDef.spot.innerConeAngle : 0;
					lightDef.spot.outerConeAngle = lightDef.spot.outerConeAngle !== undefined ? lightDef.spot.outerConeAngle : Math.PI / 4.0;
					lightNode.angle = lightDef.spot.outerConeAngle;
					lightNode.penumbra = 1.0 - lightDef.spot.innerConeAngle / lightDef.spot.outerConeAngle;
					lightNode.target.position.set( 0, 0, - 1 );
					lightNode.add( lightNode.target );
					break;

				default:
					throw new Error( 'THREE.GLTFLoader: Unexpected light type: ' + lightDef.type );

			} // Some lights (e.g. spot) default to a position other than the origin. Reset the position
			// here, because node-level parsing will only override position if explicitly specified.


			lightNode.position.set( 0, 0, 0 );
			lightNode.decay = 2;
			if ( lightDef.intensity !== undefined ) lightNode.intensity = lightDef.intensity;
			lightNode.name = parser.createUniqueName( lightDef.name || 'light_' + lightIndex );
			dependency = Promise.resolve( lightNode );
			parser.cache.add( cacheKey, dependency );
			return dependency;

		}

		createNodeAttachment( nodeIndex ) {

			const self = this;
			const parser = this.parser;
			const json = parser.json;
			const nodeDef = json.nodes[ nodeIndex ];
			const lightDef = nodeDef.extensions && nodeDef.extensions[ this.name ] || {};
			const lightIndex = lightDef.light;
			if ( lightIndex === undefined ) return null;
			return this._loadLight( lightIndex ).then( function ( light ) {

				return parser._getNodeRef( self.cache, lightIndex, light );

			} );

		}

	}
	/**
	 * Unlit Materials Extension
	 *
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_unlit
	 */


	class GLTFMaterialsUnlitExtension {

		constructor() {

			this.name = EXTENSIONS.KHR_MATERIALS_UNLIT;

		}

		getMaterialType() {

			return THREE.MeshBasicMaterial;

		}

		extendParams( materialParams, materialDef, parser ) {

			const pending = [];
			materialParams.color = new THREE.Color( 1.0, 1.0, 1.0 );
			materialParams.opacity = 1.0;
			const metallicRoughness = materialDef.pbrMetallicRoughness;

			if ( metallicRoughness ) {

				if ( Array.isArray( metallicRoughness.baseColorFactor ) ) {

					const array = metallicRoughness.baseColorFactor;
					materialParams.color.fromArray( array );
					materialParams.opacity = array[ 3 ];

				}

				if ( metallicRoughness.baseColorTexture !== undefined ) {

					pending.push( parser.assignTexture( materialParams, 'map', metallicRoughness.baseColorTexture ) );

				}

			}

			return Promise.all( pending );

		}

	}
	/**
	 * Clearcoat Materials Extension
	 *
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_clearcoat
	 */


	class GLTFMaterialsClearcoatExtension {

		constructor( parser ) {

			this.parser = parser;
			this.name = EXTENSIONS.KHR_MATERIALS_CLEARCOAT;

		}

		getMaterialType( materialIndex ) {

			const parser = this.parser;
			const materialDef = parser.json.materials[ materialIndex ];
			if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) return null;
			return THREE.MeshPhysicalMaterial;

		}

		extendMaterialParams( materialIndex, materialParams ) {

			const parser = this.parser;
			const materialDef = parser.json.materials[ materialIndex ];

			if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) {

				return Promise.resolve();

			}

			const pending = [];
			const extension = materialDef.extensions[ this.name ];

			if ( extension.clearcoatFactor !== undefined ) {

				materialParams.clearcoat = extension.clearcoatFactor;

			}

			if ( extension.clearcoatTexture !== undefined ) {

				pending.push( parser.assignTexture( materialParams, 'clearcoatMap', extension.clearcoatTexture ) );

			}

			if ( extension.clearcoatRoughnessFactor !== undefined ) {

				materialParams.clearcoatRoughness = extension.clearcoatRoughnessFactor;

			}

			if ( extension.clearcoatRoughnessTexture !== undefined ) {

				pending.push( parser.assignTexture( materialParams, 'clearcoatRoughnessMap', extension.clearcoatRoughnessTexture ) );

			}

			if ( extension.clearcoatNormalTexture !== undefined ) {

				pending.push( parser.assignTexture( materialParams, 'clearcoatNormalMap', extension.clearcoatNormalTexture ) );

				if ( extension.clearcoatNormalTexture.scale !== undefined ) {

					const scale = extension.clearcoatNormalTexture.scale; // https://github.com/mrdoob/three.js/issues/11438#issuecomment-507003995

					materialParams.clearcoatNormalScale = new THREE.Vector2( scale, - scale );

				}

			}

			return Promise.all( pending );

		}

	}
	/**
	 * Transmission Materials Extension
	 *
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_transmission
	 * Draft: https://github.com/KhronosGroup/glTF/pull/1698
	 */


	class GLTFMaterialsTransmissionExtension {

		constructor( parser ) {

			this.parser = parser;
			this.name = EXTENSIONS.KHR_MATERIALS_TRANSMISSION;

		}

		getMaterialType( materialIndex ) {

			const parser = this.parser;
			const materialDef = parser.json.materials[ materialIndex ];
			if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) return null;
			return THREE.MeshPhysicalMaterial;

		}

		extendMaterialParams( materialIndex, materialParams ) {

			const parser = this.parser;
			const materialDef = parser.json.materials[ materialIndex ];

			if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) {

				return Promise.resolve();

			}

			const pending = [];
			const extension = materialDef.extensions[ this.name ];

			if ( extension.transmissionFactor !== undefined ) {

				materialParams.transmission = extension.transmissionFactor;

			}

			if ( extension.transmissionTexture !== undefined ) {

				pending.push( parser.assignTexture( materialParams, 'transmissionMap', extension.transmissionTexture ) );

			}

			return Promise.all( pending );

		}

	}
	/**
	 * BasisU Texture Extension
	 *
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_texture_basisu
	 */


	class GLTFTextureBasisUExtension {

		constructor( parser ) {

			this.parser = parser;
			this.name = EXTENSIONS.KHR_TEXTURE_BASISU;

		}

		loadTexture( textureIndex ) {

			const parser = this.parser;
			const json = parser.json;
			const textureDef = json.textures[ textureIndex ];

			if ( ! textureDef.extensions || ! textureDef.extensions[ this.name ] ) {

				return null;

			}

			const extension = textureDef.extensions[ this.name ];
			const source = json.images[ extension.source ];
			const loader = parser.options.ktx2Loader;

			if ( ! loader ) {

				if ( json.extensionsRequired && json.extensionsRequired.indexOf( this.name ) >= 0 ) {

					throw new Error( 'THREE.GLTFLoader: setKTX2Loader must be called before loading KTX2 textures' );

				} else {

					// Assumes that the extension is optional and that a fallback texture is present
					return null;

				}

			}

			return parser.loadTextureImage( textureIndex, source, loader );

		}

	}
	/**
	 * WebP Texture Extension
	 *
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Vendor/EXT_texture_webp
	 */


	class GLTFTextureWebPExtension {

		constructor( parser ) {

			this.parser = parser;
			this.name = EXTENSIONS.EXT_TEXTURE_WEBP;
			this.isSupported = null;

		}

		loadTexture( textureIndex ) {

			const name = this.name;
			const parser = this.parser;
			const json = parser.json;
			const textureDef = json.textures[ textureIndex ];

			if ( ! textureDef.extensions || ! textureDef.extensions[ name ] ) {

				return null;

			}

			const extension = textureDef.extensions[ name ];
			const source = json.images[ extension.source ];
			let loader = parser.textureLoader;

			if ( source.uri ) {

				const handler = parser.options.manager.getHandler( source.uri );
				if ( handler !== null ) loader = handler;

			}

			return this.detectSupport().then( function ( isSupported ) {

				if ( isSupported ) return parser.loadTextureImage( textureIndex, source, loader );

				if ( json.extensionsRequired && json.extensionsRequired.indexOf( name ) >= 0 ) {

					throw new Error( 'THREE.GLTFLoader: WebP required by asset but unsupported.' );

				} // Fall back to PNG or JPEG.


				return parser.loadTexture( textureIndex );

			} );

		}

		detectSupport() {

			if ( ! this.isSupported ) {

				this.isSupported = new Promise( function ( resolve ) {

					const image = new Image(); // Lossy test image. Support for lossy images doesn't guarantee support for all
					// WebP images, unfortunately.

					image.src = 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';

					image.onload = image.onerror = function () {

						resolve( image.height === 1 );

					};

				} );

			}

			return this.isSupported;

		}

	}
	/**
	* meshopt BufferView Compression Extension
	*
	* Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Vendor/EXT_meshopt_compression
	*/


	class GLTFMeshoptCompression {

		constructor( parser ) {

			this.name = EXTENSIONS.EXT_MESHOPT_COMPRESSION;
			this.parser = parser;

		}

		loadBufferView( index ) {

			const json = this.parser.json;
			const bufferView = json.bufferViews[ index ];

			if ( bufferView.extensions && bufferView.extensions[ this.name ] ) {

				const extensionDef = bufferView.extensions[ this.name ];
				const buffer = this.parser.getDependency( 'buffer', extensionDef.buffer );
				const decoder = this.parser.options.meshoptDecoder;

				if ( ! decoder || ! decoder.supported ) {

					if ( json.extensionsRequired && json.extensionsRequired.indexOf( this.name ) >= 0 ) {

						throw new Error( 'THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files' );

					} else {

						// Assumes that the extension is optional and that fallback buffer data is present
						return null;

					}

				}

				return Promise.all( [ buffer, decoder.ready ] ).then( function ( res ) {

					const byteOffset = extensionDef.byteOffset || 0;
					const byteLength = extensionDef.byteLength || 0;
					const count = extensionDef.count;
					const stride = extensionDef.byteStride;
					const result = new ArrayBuffer( count * stride );
					const source = new Uint8Array( res[ 0 ], byteOffset, byteLength );
					decoder.decodeGltfBuffer( new Uint8Array( result ), count, stride, source, extensionDef.mode, extensionDef.filter );
					return result;

				} );

			} else {

				return null;

			}

		}

	}
	/* BINARY EXTENSION */


	const BINARY_EXTENSION_HEADER_MAGIC = 'glTF';
	const BINARY_EXTENSION_HEADER_LENGTH = 12;
	const BINARY_EXTENSION_CHUNK_TYPES = {
		JSON: 0x4E4F534A,
		BIN: 0x004E4942
	};

	class GLTFBinaryExtension {

		constructor( data ) {

			this.name = EXTENSIONS.KHR_BINARY_GLTF;
			this.content = null;
			this.body = null;
			const headerView = new DataView( data, 0, BINARY_EXTENSION_HEADER_LENGTH );
			this.header = {
				magic: THREE.LoaderUtils.decodeText( new Uint8Array( data.slice( 0, 4 ) ) ),
				version: headerView.getUint32( 4, true ),
				length: headerView.getUint32( 8, true )
			};

			if ( this.header.magic !== BINARY_EXTENSION_HEADER_MAGIC ) {

				throw new Error( 'THREE.GLTFLoader: Unsupported glTF-Binary header.' );

			} else if ( this.header.version < 2.0 ) {

				throw new Error( 'THREE.GLTFLoader: Legacy binary file detected.' );

			}

			const chunkContentsLength = this.header.length - BINARY_EXTENSION_HEADER_LENGTH;
			const chunkView = new DataView( data, BINARY_EXTENSION_HEADER_LENGTH );
			let chunkIndex = 0;

			while ( chunkIndex < chunkContentsLength ) {

				const chunkLength = chunkView.getUint32( chunkIndex, true );
				chunkIndex += 4;
				const chunkType = chunkView.getUint32( chunkIndex, true );
				chunkIndex += 4;

				if ( chunkType === BINARY_EXTENSION_CHUNK_TYPES.JSON ) {

					const contentArray = new Uint8Array( data, BINARY_EXTENSION_HEADER_LENGTH + chunkIndex, chunkLength );
					this.content = THREE.LoaderUtils.decodeText( contentArray );

				} else if ( chunkType === BINARY_EXTENSION_CHUNK_TYPES.BIN ) {

					const byteOffset = BINARY_EXTENSION_HEADER_LENGTH + chunkIndex;
					this.body = data.slice( byteOffset, byteOffset + chunkLength );

				} // Clients must ignore chunks with unknown types.


				chunkIndex += chunkLength;

			}

			if ( this.content === null ) {

				throw new Error( 'THREE.GLTFLoader: JSON content not found.' );

			}

		}

	}
	/**
	 * DRACO THREE.Mesh Compression Extension
	 *
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_draco_mesh_compression
	 */


	class GLTFDracoMeshCompressionExtension {

		constructor( json, dracoLoader ) {

			if ( ! dracoLoader ) {

				throw new Error( 'THREE.GLTFLoader: No DRACOLoader instance provided.' );

			}

			this.name = EXTENSIONS.KHR_DRACO_MESH_COMPRESSION;
			this.json = json;
			this.dracoLoader = dracoLoader;
			this.dracoLoader.preload();

		}

		decodePrimitive( primitive, parser ) {

			const json = this.json;
			const dracoLoader = this.dracoLoader;
			const bufferViewIndex = primitive.extensions[ this.name ].bufferView;
			const gltfAttributeMap = primitive.extensions[ this.name ].attributes;
			const threeAttributeMap = {};
			const attributeNormalizedMap = {};
			const attributeTypeMap = {};

			for ( const attributeName in gltfAttributeMap ) {

				const threeAttributeName = ATTRIBUTES[ attributeName ] || attributeName.toLowerCase();
				threeAttributeMap[ threeAttributeName ] = gltfAttributeMap[ attributeName ];

			}

			for ( const attributeName in primitive.attributes ) {

				const threeAttributeName = ATTRIBUTES[ attributeName ] || attributeName.toLowerCase();

				if ( gltfAttributeMap[ attributeName ] !== undefined ) {

					const accessorDef = json.accessors[ primitive.attributes[ attributeName ] ];
					const componentType = WEBGL_COMPONENT_TYPES[ accessorDef.componentType ];
					attributeTypeMap[ threeAttributeName ] = componentType;
					attributeNormalizedMap[ threeAttributeName ] = accessorDef.normalized === true;

				}

			}

			return parser.getDependency( 'bufferView', bufferViewIndex ).then( function ( bufferView ) {

				return new Promise( function ( resolve ) {

					dracoLoader.decodeDracoFile( bufferView, function ( geometry ) {

						for ( const attributeName in geometry.attributes ) {

							const attribute = geometry.attributes[ attributeName ];
							const normalized = attributeNormalizedMap[ attributeName ];
							if ( normalized !== undefined ) attribute.normalized = normalized;

						}

						resolve( geometry );

					}, threeAttributeMap, attributeTypeMap );

				} );

			} );

		}

	}
	/**
	 * Texture Transform Extension
	 *
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_texture_transform
	 */


	class GLTFTextureTransformExtension {

		constructor() {

			this.name = EXTENSIONS.KHR_TEXTURE_TRANSFORM;

		}

		extendTexture( texture, transform ) {

			texture = texture.clone();

			if ( transform.offset !== undefined ) {

				texture.offset.fromArray( transform.offset );

			}

			if ( transform.rotation !== undefined ) {

				texture.rotation = transform.rotation;

			}

			if ( transform.scale !== undefined ) {

				texture.repeat.fromArray( transform.scale );

			}

			if ( transform.texCoord !== undefined ) {

				console.warn( 'THREE.GLTFLoader: Custom UV sets in "' + this.name + '" extension not yet supported.' );

			}

			texture.needsUpdate = true;
			return texture;

		}

	}
	/**
	 * Specular-Glossiness Extension
	 *
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_pbrSpecularGlossiness
	 */

	/**
	 * A sub class of StandardMaterial with some of the functionality
	 * changed via the `onBeforeCompile` callback
	 * @pailhead
	 */


	class GLTFMeshStandardSGMaterial extends THREE.MeshStandardMaterial {

		constructor( params ) {

			super();
			this.isGLTFSpecularGlossinessMaterial = true; //various chunks that need replacing

			const specularMapParsFragmentChunk = [ '#ifdef USE_SPECULARMAP', '	uniform sampler2D specularMap;', '#endif' ].join( '\n' );
			const glossinessMapParsFragmentChunk = [ '#ifdef USE_GLOSSINESSMAP', '	uniform sampler2D glossinessMap;', '#endif' ].join( '\n' );
			const specularMapFragmentChunk = [ 'vec3 specularFactor = specular;', '#ifdef USE_SPECULARMAP', '	vec4 texelSpecular = texture2D( specularMap, vUv );', '	texelSpecular = sRGBToLinear( texelSpecular );', '	// reads channel RGB, compatible with a glTF Specular-Glossiness (RGBA) texture', '	specularFactor *= texelSpecular.rgb;', '#endif' ].join( '\n' );
			const glossinessMapFragmentChunk = [ 'float glossinessFactor = glossiness;', '#ifdef USE_GLOSSINESSMAP', '	vec4 texelGlossiness = texture2D( glossinessMap, vUv );', '	// reads channel A, compatible with a glTF Specular-Glossiness (RGBA) texture', '	glossinessFactor *= texelGlossiness.a;', '#endif' ].join( '\n' );
			const lightPhysicalFragmentChunk = [ 'PhysicalMaterial material;', 'material.diffuseColor = diffuseColor.rgb * ( 1. - max( specularFactor.r, max( specularFactor.g, specularFactor.b ) ) );', 'vec3 dxy = max( abs( dFdx( geometryNormal ) ), abs( dFdy( geometryNormal ) ) );', 'float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );', 'material.specularRoughness = max( 1.0 - glossinessFactor, 0.0525 ); // 0.0525 corresponds to the base mip of a 256 cubemap.', 'material.specularRoughness += geometryRoughness;', 'material.specularRoughness = min( material.specularRoughness, 1.0 );', 'material.specularColor = specularFactor;' ].join( '\n' );
			const uniforms = {
				specular: {
					value: new THREE.Color().setHex( 0xffffff )
				},
				glossiness: {
					value: 1
				},
				specularMap: {
					value: null
				},
				glossinessMap: {
					value: null
				}
			};
			this._extraUniforms = uniforms;

			this.onBeforeCompile = function ( shader ) {

				for ( const uniformName in uniforms ) {

					shader.uniforms[ uniformName ] = uniforms[ uniformName ];

				}

				shader.fragmentShader = shader.fragmentShader.replace( 'uniform float roughness;', 'uniform vec3 specular;' ).replace( 'uniform float metalness;', 'uniform float glossiness;' ).replace( '#include <roughnessmap_pars_fragment>', specularMapParsFragmentChunk ).replace( '#include <metalnessmap_pars_fragment>', glossinessMapParsFragmentChunk ).replace( '#include <roughnessmap_fragment>', specularMapFragmentChunk ).replace( '#include <metalnessmap_fragment>', glossinessMapFragmentChunk ).replace( '#include <lights_physical_fragment>', lightPhysicalFragmentChunk );

			};

			Object.defineProperties( this, {
				specular: {
					get: function () {

						return uniforms.specular.value;

					},
					set: function ( v ) {

						uniforms.specular.value = v;

					}
				},
				specularMap: {
					get: function () {

						return uniforms.specularMap.value;

					},
					set: function ( v ) {

						uniforms.specularMap.value = v;

						if ( v ) {

							this.defines.USE_SPECULARMAP = ''; // USE_UV is set by the renderer for specular maps

						} else {

							delete this.defines.USE_SPECULARMAP;

						}

					}
				},
				glossiness: {
					get: function () {

						return uniforms.glossiness.value;

					},
					set: function ( v ) {

						uniforms.glossiness.value = v;

					}
				},
				glossinessMap: {
					get: function () {

						return uniforms.glossinessMap.value;

					},
					set: function ( v ) {

						uniforms.glossinessMap.value = v;

						if ( v ) {

							this.defines.USE_GLOSSINESSMAP = '';
							this.defines.USE_UV = '';

						} else {

							delete this.defines.USE_GLOSSINESSMAP;
							delete this.defines.USE_UV;

						}

					}
				}
			} );
			delete this.metalness;
			delete this.roughness;
			delete this.metalnessMap;
			delete this.roughnessMap;
			this.setValues( params );

		}

		copy( source ) {

			super.copy( source );
			this.specularMap = source.specularMap;
			this.specular.copy( source.specular );
			this.glossinessMap = source.glossinessMap;
			this.glossiness = source.glossiness;
			delete this.metalness;
			delete this.roughness;
			delete this.metalnessMap;
			delete this.roughnessMap;
			return this;

		}

	}

	class GLTFMaterialsPbrSpecularGlossinessExtension {

		constructor() {

			this.name = EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS;
			this.specularGlossinessParams = [ 'color', 'map', 'lightMap', 'lightMapIntensity', 'aoMap', 'aoMapIntensity', 'emissive', 'emissiveIntensity', 'emissiveMap', 'bumpMap', 'bumpScale', 'normalMap', 'normalMapType', 'displacementMap', 'displacementScale', 'displacementBias', 'specularMap', 'specular', 'glossinessMap', 'glossiness', 'alphaMap', 'envMap', 'envMapIntensity', 'refractionRatio' ];

		}

		getMaterialType() {

			return GLTFMeshStandardSGMaterial;

		}

		extendParams( materialParams, materialDef, parser ) {

			const pbrSpecularGlossiness = materialDef.extensions[ this.name ];
			materialParams.color = new THREE.Color( 1.0, 1.0, 1.0 );
			materialParams.opacity = 1.0;
			const pending = [];

			if ( Array.isArray( pbrSpecularGlossiness.diffuseFactor ) ) {

				const array = pbrSpecularGlossiness.diffuseFactor;
				materialParams.color.fromArray( array );
				materialParams.opacity = array[ 3 ];

			}

			if ( pbrSpecularGlossiness.diffuseTexture !== undefined ) {

				pending.push( parser.assignTexture( materialParams, 'map', pbrSpecularGlossiness.diffuseTexture ) );

			}

			materialParams.emissive = new THREE.Color( 0.0, 0.0, 0.0 );
			materialParams.glossiness = pbrSpecularGlossiness.glossinessFactor !== undefined ? pbrSpecularGlossiness.glossinessFactor : 1.0;
			materialParams.specular = new THREE.Color( 1.0, 1.0, 1.0 );

			if ( Array.isArray( pbrSpecularGlossiness.specularFactor ) ) {

				materialParams.specular.fromArray( pbrSpecularGlossiness.specularFactor );

			}

			if ( pbrSpecularGlossiness.specularGlossinessTexture !== undefined ) {

				const specGlossMapDef = pbrSpecularGlossiness.specularGlossinessTexture;
				pending.push( parser.assignTexture( materialParams, 'glossinessMap', specGlossMapDef ) );
				pending.push( parser.assignTexture( materialParams, 'specularMap', specGlossMapDef ) );

			}

			return Promise.all( pending );

		}

		createMaterial( materialParams ) {

			const material = new GLTFMeshStandardSGMaterial( materialParams );
			material.fog = true;
			material.color = materialParams.color;
			material.map = materialParams.map === undefined ? null : materialParams.map;
			material.lightMap = null;
			material.lightMapIntensity = 1.0;
			material.aoMap = materialParams.aoMap === undefined ? null : materialParams.aoMap;
			material.aoMapIntensity = 1.0;
			material.emissive = materialParams.emissive;
			material.emissiveIntensity = 1.0;
			material.emissiveMap = materialParams.emissiveMap === undefined ? null : materialParams.emissiveMap;
			material.bumpMap = materialParams.bumpMap === undefined ? null : materialParams.bumpMap;
			material.bumpScale = 1;
			material.normalMap = materialParams.normalMap === undefined ? null : materialParams.normalMap;
			material.normalMapType = THREE.TangentSpaceNormalMap;
			if ( materialParams.normalScale ) material.normalScale = materialParams.normalScale;
			material.displacementMap = null;
			material.displacementScale = 1;
			material.displacementBias = 0;
			material.specularMap = materialParams.specularMap === undefined ? null : materialParams.specularMap;
			material.specular = materialParams.specular;
			material.glossinessMap = materialParams.glossinessMap === undefined ? null : materialParams.glossinessMap;
			material.glossiness = materialParams.glossiness;
			material.alphaMap = null;
			material.envMap = materialParams.envMap === undefined ? null : materialParams.envMap;
			material.envMapIntensity = 1.0;
			material.refractionRatio = 0.98;
			return material;

		}

	}
	/**
	 * THREE.Mesh Quantization Extension
	 *
	 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_mesh_quantization
	 */


	class GLTFMeshQuantizationExtension {

		constructor() {

			this.name = EXTENSIONS.KHR_MESH_QUANTIZATION;

		}

	}
	/*********************************/

	/********** INTERPOLATION ********/

	/*********************************/
	// Spline Interpolation
	// Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#appendix-c-spline-interpolation


	class GLTFCubicSplineInterpolant extends THREE.Interpolant {

		constructor( parameterPositions, sampleValues, sampleSize, resultBuffer ) {

			super( parameterPositions, sampleValues, sampleSize, resultBuffer );

		}

		copySampleValue_( index ) {

			// Copies a sample value to the result buffer. See description of glTF
			// CUBICSPLINE values layout in interpolate_() function below.
			const result = this.resultBuffer,
				values = this.sampleValues,
				valueSize = this.valueSize,
				offset = index * valueSize * 3 + valueSize;

			for ( let i = 0; i !== valueSize; i ++ ) {

				result[ i ] = values[ offset + i ];

			}

			return result;

		}

	}

	GLTFCubicSplineInterpolant.prototype.beforeStart_ = GLTFCubicSplineInterpolant.prototype.copySampleValue_;
	GLTFCubicSplineInterpolant.prototype.afterEnd_ = GLTFCubicSplineInterpolant.prototype.copySampleValue_;

	GLTFCubicSplineInterpolant.prototype.interpolate_ = function ( i1, t0, t, t1 ) {

		const result = this.resultBuffer;
		const values = this.sampleValues;
		const stride = this.valueSize;
		const stride2 = stride * 2;
		const stride3 = stride * 3;
		const td = t1 - t0;
		const p = ( t - t0 ) / td;
		const pp = p * p;
		const ppp = pp * p;
		const offset1 = i1 * stride3;
		const offset0 = offset1 - stride3;
		const s2 = - 2 * ppp + 3 * pp;
		const s3 = ppp - pp;
		const s0 = 1 - s2;
		const s1 = s3 - pp + p; // Layout of keyframe output values for CUBICSPLINE animations:
		//   [ inTangent_1, splineVertex_1, outTangent_1, inTangent_2, splineVertex_2, ... ]

		for ( let i = 0; i !== stride; i ++ ) {

			const p0 = values[ offset0 + i + stride ]; // splineVertex_k

			const m0 = values[ offset0 + i + stride2 ] * td; // outTangent_k * (t_k+1 - t_k)

			const p1 = values[ offset1 + i + stride ]; // splineVertex_k+1

			const m1 = values[ offset1 + i ] * td; // inTangent_k+1 * (t_k+1 - t_k)

			result[ i ] = s0 * p0 + s1 * m0 + s2 * p1 + s3 * m1;

		}

		return result;

	};
	/*********************************/

	/********** INTERNALS ************/

	/*********************************/

	/* CONSTANTS */


	const WEBGL_CONSTANTS = {
		FLOAT: 5126,
		//FLOAT_MAT2: 35674,
		FLOAT_MAT3: 35675,
		FLOAT_MAT4: 35676,
		FLOAT_VEC2: 35664,
		FLOAT_VEC3: 35665,
		FLOAT_VEC4: 35666,
		LINEAR: 9729,
		REPEAT: 10497,
		SAMPLER_2D: 35678,
		POINTS: 0,
		LINES: 1,
		LINE_LOOP: 2,
		LINE_STRIP: 3,
		TRIANGLES: 4,
		TRIANGLE_STRIP: 5,
		TRIANGLE_FAN: 6,
		UNSIGNED_BYTE: 5121,
		UNSIGNED_SHORT: 5123
	};
	const WEBGL_COMPONENT_TYPES = {
		5120: Int8Array,
		5121: Uint8Array,
		5122: Int16Array,
		5123: Uint16Array,
		5125: Uint32Array,
		5126: Float32Array
	};
	const WEBGL_FILTERS = {
		9728: THREE.NearestFilter,
		9729: THREE.LinearFilter,
		9984: THREE.NearestMipmapNearestFilter,
		9985: THREE.LinearMipmapNearestFilter,
		9986: THREE.NearestMipmapLinearFilter,
		9987: THREE.LinearMipmapLinearFilter
	};
	const WEBGL_WRAPPINGS = {
		33071: THREE.ClampToEdgeWrapping,
		33648: THREE.MirroredRepeatWrapping,
		10497: THREE.RepeatWrapping
	};
	const WEBGL_TYPE_SIZES = {
		'SCALAR': 1,
		'VEC2': 2,
		'VEC3': 3,
		'VEC4': 4,
		'MAT2': 4,
		'MAT3': 9,
		'MAT4': 16
	};
	const ATTRIBUTES = {
		POSITION: 'position',
		NORMAL: 'normal',
		TANGENT: 'tangent',
		TEXCOORD_0: 'uv',
		TEXCOORD_1: 'uv2',
		COLOR_0: 'color',
		WEIGHTS_0: 'skinWeight',
		JOINTS_0: 'skinIndex'
	};
	const PATH_PROPERTIES = {
		scale: 'scale',
		translation: 'position',
		rotation: 'quaternion',
		weights: 'morphTargetInfluences'
	};
	const INTERPOLATION = {
		CUBICSPLINE: undefined,
		// We use a custom interpolant (GLTFCubicSplineInterpolation) for CUBICSPLINE tracks. Each
		// keyframe track will be initialized with a default interpolation type, then modified.
		LINEAR: THREE.InterpolateLinear,
		STEP: THREE.InterpolateDiscrete
	};
	const ALPHA_MODES = {
		OPAQUE: 'OPAQUE',
		MASK: 'MASK',
		BLEND: 'BLEND'
	};
	/* UTILITY FUNCTIONS */

	function resolveURL( url, path ) {

		// Invalid URL
		if ( typeof url !== 'string' || url === '' ) return ''; // Host Relative URL

		if ( /^https?:\/\//i.test( path ) && /^\//.test( url ) ) {

			path = path.replace( /(^https?:\/\/[^\/]+).*/i, '$1' );

		} // Absolute URL http://,https://,//


		if ( /^(https?:)?\/\//i.test( url ) ) return url; // Data URI

		if ( /^data:.*,.*$/i.test( url ) ) return url; // Blob URL

		if ( /^blob:.*$/i.test( url ) ) return url; // Relative URL

		return path + url;

	}
	/**
	 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#default-material
	 */


	function createDefaultMaterial( cache ) {

		if ( cache[ 'DefaultMaterial' ] === undefined ) {

			cache[ 'DefaultMaterial' ] = new THREE.MeshStandardMaterial( {
				color: 0xFFFFFF,
				emissive: 0x000000,
				metalness: 1,
				roughness: 1,
				transparent: false,
				depthTest: true,
				side: THREE.FrontSide
			} );

		}

		return cache[ 'DefaultMaterial' ];

	}

	function addUnknownExtensionsToUserData( knownExtensions, object, objectDef ) {

		// Add unknown glTF extensions to an object's userData.
		for ( const name in objectDef.extensions ) {

			if ( knownExtensions[ name ] === undefined ) {

				object.userData.gltfExtensions = object.userData.gltfExtensions || {};
				object.userData.gltfExtensions[ name ] = objectDef.extensions[ name ];

			}

		}

	}
	/**
	 * @param {Object3D|Material|BufferGeometry} object
	 * @param {GLTF.definition} gltfDef
	 */


	function assignExtrasToUserData( object, gltfDef ) {

		if ( gltfDef.extras !== undefined ) {

			if ( typeof gltfDef.extras === 'object' ) {

				Object.assign( object.userData, gltfDef.extras );

			} else {

				console.warn( 'THREE.GLTFLoader: Ignoring primitive type .extras, ' + gltfDef.extras );

			}

		}

	}
	/**
	 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#morph-targets
	 *
	 * @param {BufferGeometry} geometry
	 * @param {Array<GLTF.Target>} targets
	 * @param {GLTFParser} parser
	 * @return {Promise<BufferGeometry>}
	 */


	function addMorphTargets( geometry, targets, parser ) {

		let hasMorphPosition = false;
		let hasMorphNormal = false;

		for ( let i = 0, il = targets.length; i < il; i ++ ) {

			const target = targets[ i ];
			if ( target.POSITION !== undefined ) hasMorphPosition = true;
			if ( target.NORMAL !== undefined ) hasMorphNormal = true;
			if ( hasMorphPosition && hasMorphNormal ) break;

		}

		if ( ! hasMorphPosition && ! hasMorphNormal ) return Promise.resolve( geometry );
		const pendingPositionAccessors = [];
		const pendingNormalAccessors = [];

		for ( let i = 0, il = targets.length; i < il; i ++ ) {

			const target = targets[ i ];

			if ( hasMorphPosition ) {

				const pendingAccessor = target.POSITION !== undefined ? parser.getDependency( 'accessor', target.POSITION ) : geometry.attributes.position;
				pendingPositionAccessors.push( pendingAccessor );

			}

			if ( hasMorphNormal ) {

				const pendingAccessor = target.NORMAL !== undefined ? parser.getDependency( 'accessor', target.NORMAL ) : geometry.attributes.normal;
				pendingNormalAccessors.push( pendingAccessor );

			}

		}

		return Promise.all( [ Promise.all( pendingPositionAccessors ), Promise.all( pendingNormalAccessors ) ] ).then( function ( accessors ) {

			const morphPositions = accessors[ 0 ];
			const morphNormals = accessors[ 1 ];
			if ( hasMorphPosition ) geometry.morphAttributes.position = morphPositions;
			if ( hasMorphNormal ) geometry.morphAttributes.normal = morphNormals;
			geometry.morphTargetsRelative = true;
			return geometry;

		} );

	}
	/**
	 * @param {Mesh} mesh
	 * @param {GLTF.Mesh} meshDef
	 */


	function updateMorphTargets( mesh, meshDef ) {

		mesh.updateMorphTargets();

		if ( meshDef.weights !== undefined ) {

			for ( let i = 0, il = meshDef.weights.length; i < il; i ++ ) {

				mesh.morphTargetInfluences[ i ] = meshDef.weights[ i ];

			}

		} // .extras has user-defined data, so check that .extras.targetNames is an array.


		if ( meshDef.extras && Array.isArray( meshDef.extras.targetNames ) ) {

			const targetNames = meshDef.extras.targetNames;

			if ( mesh.morphTargetInfluences.length === targetNames.length ) {

				mesh.morphTargetDictionary = {};

				for ( let i = 0, il = targetNames.length; i < il; i ++ ) {

					mesh.morphTargetDictionary[ targetNames[ i ] ] = i;

				}

			} else {

				console.warn( 'THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.' );

			}

		}

	}

	function createPrimitiveKey( primitiveDef ) {

		const dracoExtension = primitiveDef.extensions && primitiveDef.extensions[ EXTENSIONS.KHR_DRACO_MESH_COMPRESSION ];
		let geometryKey;

		if ( dracoExtension ) {

			geometryKey = 'draco:' + dracoExtension.bufferView + ':' + dracoExtension.indices + ':' + createAttributesKey( dracoExtension.attributes );

		} else {

			geometryKey = primitiveDef.indices + ':' + createAttributesKey( primitiveDef.attributes ) + ':' + primitiveDef.mode;

		}

		return geometryKey;

	}

	function createAttributesKey( attributes ) {

		let attributesKey = '';
		const keys = Object.keys( attributes ).sort();

		for ( let i = 0, il = keys.length; i < il; i ++ ) {

			attributesKey += keys[ i ] + ':' + attributes[ keys[ i ] ] + ';';

		}

		return attributesKey;

	}

	function getNormalizedComponentScale( constructor ) {

		// Reference:
		// https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_mesh_quantization#encoding-quantized-data
		switch ( constructor ) {

			case Int8Array:
				return 1 / 127;

			case Uint8Array:
				return 1 / 255;

			case Int16Array:
				return 1 / 32767;

			case Uint16Array:
				return 1 / 65535;

			default:
				throw new Error( 'THREE.GLTFLoader: Unsupported normalized accessor component type.' );

		}

	}
	/* GLTF PARSER */


	class GLTFParser {

		constructor( json = {}, options = {} ) {

			this.json = json;
			this.extensions = {};
			this.plugins = {};
			this.options = options; // loader object cache

			this.cache = new GLTFRegistry(); // associations between Three.js objects and glTF elements

			this.associations = new Map(); // THREE.BufferGeometry caching

			this.primitiveCache = {}; // THREE.Object3D instance caches

			this.meshCache = {
				refs: {},
				uses: {}
			};
			this.cameraCache = {
				refs: {},
				uses: {}
			};
			this.lightCache = {
				refs: {},
				uses: {}
			}; // Track node names, to ensure no duplicates

			this.nodeNamesUsed = {}; // Use an THREE.ImageBitmapLoader if imageBitmaps are supported. Moves much of the
			// expensive work of uploading a texture to the GPU off the main thread.

			if ( typeof createImageBitmap !== 'undefined' && /Firefox/.test( navigator.userAgent ) === false ) {

				this.textureLoader = new THREE.ImageBitmapLoader( this.options.manager );

			} else {

				this.textureLoader = new THREE.TextureLoader( this.options.manager );

			}

			this.textureLoader.setCrossOrigin( this.options.crossOrigin );
			this.textureLoader.setRequestHeader( this.options.requestHeader );
			this.fileLoader = new THREE.FileLoader( this.options.manager );
			this.fileLoader.setResponseType( 'arraybuffer' );

			if ( this.options.crossOrigin === 'use-credentials' ) {

				this.fileLoader.setWithCredentials( true );

			}

		}

		setExtensions( extensions ) {

			this.extensions = extensions;

		}

		setPlugins( plugins ) {

			this.plugins = plugins;

		}

		parse( onLoad, onError ) {

			const parser = this;
			const json = this.json;
			const extensions = this.extensions; // Clear the loader cache

			this.cache.removeAll(); // Mark the special nodes/meshes in json for efficient parse

			this._invokeAll( function ( ext ) {

				return ext._markDefs && ext._markDefs();

			} );

			Promise.all( this._invokeAll( function ( ext ) {

				return ext.beforeRoot && ext.beforeRoot();

			} ) ).then( function () {

				return Promise.all( [ parser.getDependencies( 'scene' ), parser.getDependencies( 'animation' ), parser.getDependencies( 'camera' ) ] );

			} ).then( function ( dependencies ) {

				const result = {
					scene: dependencies[ 0 ][ json.scene || 0 ],
					scenes: dependencies[ 0 ],
					animations: dependencies[ 1 ],
					cameras: dependencies[ 2 ],
					asset: json.asset,
					parser: parser,
					userData: {}
				};
				addUnknownExtensionsToUserData( extensions, result, json );
				assignExtrasToUserData( result, json );
				Promise.all( parser._invokeAll( function ( ext ) {

					return ext.afterRoot && ext.afterRoot( result );

				} ) ).then( function () {

					onLoad( result );

				} );

			} ).catch( onError );

		}
		/**
   * Marks the special nodes/meshes in json for efficient parse.
   */


		_markDefs() {

			const nodeDefs = this.json.nodes || [];
			const skinDefs = this.json.skins || [];
			const meshDefs = this.json.meshes || []; // Nothing in the node definition indicates whether it is a THREE.Bone or an
			// THREE.Object3D. Use the skins' joint references to mark bones.

			for ( let skinIndex = 0, skinLength = skinDefs.length; skinIndex < skinLength; skinIndex ++ ) {

				const joints = skinDefs[ skinIndex ].joints;

				for ( let i = 0, il = joints.length; i < il; i ++ ) {

					nodeDefs[ joints[ i ] ].isBone = true;

				}

			} // Iterate over all nodes, marking references to shared resources,
			// as well as skeleton joints.


			for ( let nodeIndex = 0, nodeLength = nodeDefs.length; nodeIndex < nodeLength; nodeIndex ++ ) {

				const nodeDef = nodeDefs[ nodeIndex ];

				if ( nodeDef.mesh !== undefined ) {

					this._addNodeRef( this.meshCache, nodeDef.mesh ); // Nothing in the mesh definition indicates whether it is
					// a THREE.SkinnedMesh or THREE.Mesh. Use the node's mesh reference
					// to mark THREE.SkinnedMesh if node has skin.


					if ( nodeDef.skin !== undefined ) {

						meshDefs[ nodeDef.mesh ].isSkinnedMesh = true;

					}

				}

				if ( nodeDef.camera !== undefined ) {

					this._addNodeRef( this.cameraCache, nodeDef.camera );

				}

			}

		}
		/**
   * Counts references to shared node / THREE.Object3D resources. These resources
   * can be reused, or "instantiated", at multiple nodes in the scene
   * hierarchy. THREE.Mesh, Camera, and Light instances are instantiated and must
   * be marked. Non-scenegraph resources (like Materials, Geometries, and
   * Textures) can be reused directly and are not marked here.
   *
   * Example: CesiumMilkTruck sample model reuses "Wheel" meshes.
   */


		_addNodeRef( cache, index ) {

			if ( index === undefined ) return;

			if ( cache.refs[ index ] === undefined ) {

				cache.refs[ index ] = cache.uses[ index ] = 0;

			}

			cache.refs[ index ] ++;

		}
		/** Returns a reference to a shared resource, cloning it if necessary. */


		_getNodeRef( cache, index, object ) {

			if ( cache.refs[ index ] <= 1 ) return object;
			const ref = object.clone();
			ref.name += '_instance_' + cache.uses[ index ] ++;
			return ref;

		}

		_invokeOne( func ) {

			const extensions = Object.values( this.plugins );
			extensions.push( this );

			for ( let i = 0; i < extensions.length; i ++ ) {

				const result = func( extensions[ i ] );
				if ( result ) return result;

			}

			return null;

		}

		_invokeAll( func ) {

			const extensions = Object.values( this.plugins );
			extensions.unshift( this );
			const pending = [];

			for ( let i = 0; i < extensions.length; i ++ ) {

				const result = func( extensions[ i ] );
				if ( result ) pending.push( result );

			}

			return pending;

		}
		/**
   * Requests the specified dependency asynchronously, with caching.
   * @param {string} type
   * @param {number} index
   * @return {Promise<Object3D|Material|THREE.Texture|AnimationClip|ArrayBuffer|Object>}
   */


		getDependency( type, index ) {

			const cacheKey = type + ':' + index;
			let dependency = this.cache.get( cacheKey );

			if ( ! dependency ) {

				switch ( type ) {

					case 'scene':
						dependency = this.loadScene( index );
						break;

					case 'node':
						dependency = this.loadNode( index );
						break;

					case 'mesh':
						dependency = this._invokeOne( function ( ext ) {

							return ext.loadMesh && ext.loadMesh( index );

						} );
						break;

					case 'accessor':
						dependency = this.loadAccessor( index );
						break;

					case 'bufferView':
						dependency = this._invokeOne( function ( ext ) {

							return ext.loadBufferView && ext.loadBufferView( index );

						} );
						break;

					case 'buffer':
						dependency = this.loadBuffer( index );
						break;

					case 'material':
						dependency = this._invokeOne( function ( ext ) {

							return ext.loadMaterial && ext.loadMaterial( index );

						} );
						break;

					case 'texture':
						dependency = this._invokeOne( function ( ext ) {

							return ext.loadTexture && ext.loadTexture( index );

						} );
						break;

					case 'skin':
						dependency = this.loadSkin( index );
						break;

					case 'animation':
						dependency = this.loadAnimation( index );
						break;

					case 'camera':
						dependency = this.loadCamera( index );
						break;

					default:
						throw new Error( 'Unknown type: ' + type );

				}

				this.cache.add( cacheKey, dependency );

			}

			return dependency;

		}
		/**
   * Requests all dependencies of the specified type asynchronously, with caching.
   * @param {string} type
   * @return {Promise<Array<Object>>}
   */


		getDependencies( type ) {

			let dependencies = this.cache.get( type );

			if ( ! dependencies ) {

				const parser = this;
				const defs = this.json[ type + ( type === 'mesh' ? 'es' : 's' ) ] || [];
				dependencies = Promise.all( defs.map( function ( def, index ) {

					return parser.getDependency( type, index );

				} ) );
				this.cache.add( type, dependencies );

			}

			return dependencies;

		}
		/**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#buffers-and-buffer-views
   * @param {number} bufferIndex
   * @return {Promise<ArrayBuffer>}
   */


		loadBuffer( bufferIndex ) {

			const bufferDef = this.json.buffers[ bufferIndex ];
			const loader = this.fileLoader;

			if ( bufferDef.type && bufferDef.type !== 'arraybuffer' ) {

				throw new Error( 'THREE.GLTFLoader: ' + bufferDef.type + ' buffer type is not supported.' );

			} // If present, GLB container is required to be the first buffer.


			if ( bufferDef.uri === undefined && bufferIndex === 0 ) {

				return Promise.resolve( this.extensions[ EXTENSIONS.KHR_BINARY_GLTF ].body );

			}

			const options = this.options;
			return new Promise( function ( resolve, reject ) {

				loader.load( resolveURL( bufferDef.uri, options.path ), resolve, undefined, function () {

					reject( new Error( 'THREE.GLTFLoader: Failed to load buffer "' + bufferDef.uri + '".' ) );

				} );

			} );

		}
		/**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#buffers-and-buffer-views
   * @param {number} bufferViewIndex
   * @return {Promise<ArrayBuffer>}
   */


		loadBufferView( bufferViewIndex ) {

			const bufferViewDef = this.json.bufferViews[ bufferViewIndex ];
			return this.getDependency( 'buffer', bufferViewDef.buffer ).then( function ( buffer ) {

				const byteLength = bufferViewDef.byteLength || 0;
				const byteOffset = bufferViewDef.byteOffset || 0;
				return buffer.slice( byteOffset, byteOffset + byteLength );

			} );

		}
		/**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#accessors
   * @param {number} accessorIndex
   * @return {Promise<BufferAttribute|InterleavedBufferAttribute>}
   */


		loadAccessor( accessorIndex ) {

			const parser = this;
			const json = this.json;
			const accessorDef = this.json.accessors[ accessorIndex ];

			if ( accessorDef.bufferView === undefined && accessorDef.sparse === undefined ) {

				// Ignore empty accessors, which may be used to declare runtime
				// information about attributes coming from another source (e.g. Draco
				// compression extension).
				return Promise.resolve( null );

			}

			const pendingBufferViews = [];

			if ( accessorDef.bufferView !== undefined ) {

				pendingBufferViews.push( this.getDependency( 'bufferView', accessorDef.bufferView ) );

			} else {

				pendingBufferViews.push( null );

			}

			if ( accessorDef.sparse !== undefined ) {

				pendingBufferViews.push( this.getDependency( 'bufferView', accessorDef.sparse.indices.bufferView ) );
				pendingBufferViews.push( this.getDependency( 'bufferView', accessorDef.sparse.values.bufferView ) );

			}

			return Promise.all( pendingBufferViews ).then( function ( bufferViews ) {

				const bufferView = bufferViews[ 0 ];
				const itemSize = WEBGL_TYPE_SIZES[ accessorDef.type ];
				const TypedArray = WEBGL_COMPONENT_TYPES[ accessorDef.componentType ]; // For VEC3: itemSize is 3, elementBytes is 4, itemBytes is 12.

				const elementBytes = TypedArray.BYTES_PER_ELEMENT;
				const itemBytes = elementBytes * itemSize;
				const byteOffset = accessorDef.byteOffset || 0;
				const byteStride = accessorDef.bufferView !== undefined ? json.bufferViews[ accessorDef.bufferView ].byteStride : undefined;
				const normalized = accessorDef.normalized === true;
				let array, bufferAttribute; // The buffer is not interleaved if the stride is the item size in bytes.

				if ( byteStride && byteStride !== itemBytes ) {

					// Each "slice" of the buffer, as defined by 'count' elements of 'byteStride' bytes, gets its own THREE.InterleavedBuffer
					// This makes sure that IBA.count reflects accessor.count properly
					const ibSlice = Math.floor( byteOffset / byteStride );
					const ibCacheKey = 'InterleavedBuffer:' + accessorDef.bufferView + ':' + accessorDef.componentType + ':' + ibSlice + ':' + accessorDef.count;
					let ib = parser.cache.get( ibCacheKey );

					if ( ! ib ) {

						array = new TypedArray( bufferView, ibSlice * byteStride, accessorDef.count * byteStride / elementBytes ); // Integer parameters to IB/IBA are in array elements, not bytes.

						ib = new THREE.InterleavedBuffer( array, byteStride / elementBytes );
						parser.cache.add( ibCacheKey, ib );

					}

					bufferAttribute = new THREE.InterleavedBufferAttribute( ib, itemSize, byteOffset % byteStride / elementBytes, normalized );

				} else {

					if ( bufferView === null ) {

						array = new TypedArray( accessorDef.count * itemSize );

					} else {

						array = new TypedArray( bufferView, byteOffset, accessorDef.count * itemSize );

					}

					bufferAttribute = new THREE.BufferAttribute( array, itemSize, normalized );

				} // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#sparse-accessors


				if ( accessorDef.sparse !== undefined ) {

					const itemSizeIndices = WEBGL_TYPE_SIZES.SCALAR;
					const TypedArrayIndices = WEBGL_COMPONENT_TYPES[ accessorDef.sparse.indices.componentType ];
					const byteOffsetIndices = accessorDef.sparse.indices.byteOffset || 0;
					const byteOffsetValues = accessorDef.sparse.values.byteOffset || 0;
					const sparseIndices = new TypedArrayIndices( bufferViews[ 1 ], byteOffsetIndices, accessorDef.sparse.count * itemSizeIndices );
					const sparseValues = new TypedArray( bufferViews[ 2 ], byteOffsetValues, accessorDef.sparse.count * itemSize );

					if ( bufferView !== null ) {

						// Avoid modifying the original ArrayBuffer, if the bufferView wasn't initialized with zeroes.
						bufferAttribute = new THREE.BufferAttribute( bufferAttribute.array.slice(), bufferAttribute.itemSize, bufferAttribute.normalized );

					}

					for ( let i = 0, il = sparseIndices.length; i < il; i ++ ) {

						const index = sparseIndices[ i ];
						bufferAttribute.setX( index, sparseValues[ i * itemSize ] );
						if ( itemSize >= 2 ) bufferAttribute.setY( index, sparseValues[ i * itemSize + 1 ] );
						if ( itemSize >= 3 ) bufferAttribute.setZ( index, sparseValues[ i * itemSize + 2 ] );
						if ( itemSize >= 4 ) bufferAttribute.setW( index, sparseValues[ i * itemSize + 3 ] );
						if ( itemSize >= 5 ) throw new Error( 'THREE.GLTFLoader: Unsupported itemSize in sparse THREE.BufferAttribute.' );

					}

				}

				return bufferAttribute;

			} );

		}
		/**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#textures
   * @param {number} textureIndex
   * @return {Promise<THREE.Texture>}
   */


		loadTexture( textureIndex ) {

			const json = this.json;
			const options = this.options;
			const textureDef = json.textures[ textureIndex ];
			const source = json.images[ textureDef.source ];
			let loader = this.textureLoader;

			if ( source.uri ) {

				const handler = options.manager.getHandler( source.uri );
				if ( handler !== null ) loader = handler;

			}

			return this.loadTextureImage( textureIndex, source, loader );

		}

		loadTextureImage( textureIndex, source, loader ) {

			const parser = this;
			const json = this.json;
			const options = this.options;
			const textureDef = json.textures[ textureIndex ];
			const URL = self.URL || self.webkitURL;
			let sourceURI = source.uri;
			let isObjectURL = false;
			let hasAlpha = true;
			if ( source.mimeType === 'image/jpeg' ) hasAlpha = false;

			if ( source.bufferView !== undefined ) {

				// Load binary image data from bufferView, if provided.
				sourceURI = parser.getDependency( 'bufferView', source.bufferView ).then( function ( bufferView ) {

					if ( source.mimeType === 'image/png' ) {

						// Inspect the PNG 'IHDR' chunk to determine whether the image could have an
						// alpha channel. This check is conservative — the image could have an alpha
						// channel with all values == 1, and the indexed type (colorType == 3) only
						// sometimes contains alpha.
						//
						// https://en.wikipedia.org/wiki/Portable_Network_Graphics#File_header
						const colorType = new DataView( bufferView, 25, 1 ).getUint8( 0, false );
						hasAlpha = colorType === 6 || colorType === 4 || colorType === 3;

					}

					isObjectURL = true;
					const blob = new Blob( [ bufferView ], {
						type: source.mimeType
					} );
					sourceURI = URL.createObjectURL( blob );
					return sourceURI;

				} );

			} else if ( source.uri === undefined ) {

				throw new Error( 'THREE.GLTFLoader: Image ' + textureIndex + ' is missing URI and bufferView' );

			}

			return Promise.resolve( sourceURI ).then( function ( sourceURI ) {

				return new Promise( function ( resolve, reject ) {

					let onLoad = resolve;

					if ( loader.isImageBitmapLoader === true ) {

						onLoad = function ( imageBitmap ) {

							resolve( new THREE.CanvasTexture( imageBitmap ) );

						};

					}

					loader.load( resolveURL( sourceURI, options.path ), onLoad, undefined, reject );

				} );

			} ).then( function ( texture ) {

				// Clean up resources and configure Texture.
				if ( isObjectURL === true ) {

					URL.revokeObjectURL( sourceURI );

				}

				texture.flipY = false;
				if ( textureDef.name ) texture.name = textureDef.name; // When there is definitely no alpha channel in the texture, set THREE.RGBFormat to save space.

				if ( ! hasAlpha ) texture.format = THREE.RGBFormat;
				const samplers = json.samplers || {};
				const sampler = samplers[ textureDef.sampler ] || {};
				texture.magFilter = WEBGL_FILTERS[ sampler.magFilter ] || THREE.LinearFilter;
				texture.minFilter = WEBGL_FILTERS[ sampler.minFilter ] || THREE.LinearMipmapLinearFilter;
				texture.wrapS = WEBGL_WRAPPINGS[ sampler.wrapS ] || THREE.RepeatWrapping;
				texture.wrapT = WEBGL_WRAPPINGS[ sampler.wrapT ] || THREE.RepeatWrapping;
				parser.associations.set( texture, {
					type: 'textures',
					index: textureIndex
				} );
				return texture;

			} );

		}
		/**
   * Asynchronously assigns a texture to the given material parameters.
   * @param {Object} materialParams
   * @param {string} mapName
   * @param {Object} mapDef
   * @return {Promise}
   */


		assignTexture( materialParams, mapName, mapDef ) {

			const parser = this;
			return this.getDependency( 'texture', mapDef.index ).then( function ( texture ) {

				// Materials sample aoMap from UV set 1 and other maps from UV set 0 - this can't be configured
				// However, we will copy UV set 0 to UV set 1 on demand for aoMap
				if ( mapDef.texCoord !== undefined && mapDef.texCoord != 0 && ! ( mapName === 'aoMap' && mapDef.texCoord == 1 ) ) {

					console.warn( 'THREE.GLTFLoader: Custom UV set ' + mapDef.texCoord + ' for texture ' + mapName + ' not yet supported.' );

				}

				if ( parser.extensions[ EXTENSIONS.KHR_TEXTURE_TRANSFORM ] ) {

					const transform = mapDef.extensions !== undefined ? mapDef.extensions[ EXTENSIONS.KHR_TEXTURE_TRANSFORM ] : undefined;

					if ( transform ) {

						const gltfReference = parser.associations.get( texture );
						texture = parser.extensions[ EXTENSIONS.KHR_TEXTURE_TRANSFORM ].extendTexture( texture, transform );
						parser.associations.set( texture, gltfReference );

					}

				}

				materialParams[ mapName ] = texture;

			} );

		}
		/**
   * Assigns final material to a THREE.Mesh, THREE.Line, or THREE.Points instance. The instance
   * already has a material (generated from the glTF material options alone)
   * but reuse of the same glTF material may require multiple threejs materials
   * to accommodate different primitive types, defines, etc. New materials will
   * be created if necessary, and reused from a cache.
   * @param  {Object3D} mesh THREE.Mesh, THREE.Line, or THREE.Points instance.
   */


		assignFinalMaterial( mesh ) {

			const geometry = mesh.geometry;
			let material = mesh.material;
			const useVertexTangents = geometry.attributes.tangent !== undefined;
			const useVertexColors = geometry.attributes.color !== undefined;
			const useFlatShading = geometry.attributes.normal === undefined;
			const useSkinning = mesh.isSkinnedMesh === true;
			const useMorphTargets = Object.keys( geometry.morphAttributes ).length > 0;
			const useMorphNormals = useMorphTargets && geometry.morphAttributes.normal !== undefined;

			if ( mesh.isPoints ) {

				const cacheKey = 'PointsMaterial:' + material.uuid;
				let pointsMaterial = this.cache.get( cacheKey );

				if ( ! pointsMaterial ) {

					pointsMaterial = new THREE.PointsMaterial();
					THREE.Material.prototype.copy.call( pointsMaterial, material );
					pointsMaterial.color.copy( material.color );
					pointsMaterial.map = material.map;
					pointsMaterial.sizeAttenuation = false; // glTF spec says points should be 1px

					this.cache.add( cacheKey, pointsMaterial );

				}

				material = pointsMaterial;

			} else if ( mesh.isLine ) {

				const cacheKey = 'LineBasicMaterial:' + material.uuid;
				let lineMaterial = this.cache.get( cacheKey );

				if ( ! lineMaterial ) {

					lineMaterial = new THREE.LineBasicMaterial();
					THREE.Material.prototype.copy.call( lineMaterial, material );
					lineMaterial.color.copy( material.color );
					this.cache.add( cacheKey, lineMaterial );

				}

				material = lineMaterial;

			} // Clone the material if it will be modified


			if ( useVertexTangents || useVertexColors || useFlatShading || useSkinning || useMorphTargets ) {

				let cacheKey = 'ClonedMaterial:' + material.uuid + ':';
				if ( material.isGLTFSpecularGlossinessMaterial ) cacheKey += 'specular-glossiness:';
				if ( useSkinning ) cacheKey += 'skinning:';
				if ( useVertexTangents ) cacheKey += 'vertex-tangents:';
				if ( useVertexColors ) cacheKey += 'vertex-colors:';
				if ( useFlatShading ) cacheKey += 'flat-shading:';
				if ( useMorphTargets ) cacheKey += 'morph-targets:';
				if ( useMorphNormals ) cacheKey += 'morph-normals:';
				let cachedMaterial = this.cache.get( cacheKey );

				if ( ! cachedMaterial ) {

					cachedMaterial = material.clone();
					if ( useSkinning ) cachedMaterial.skinning = true;
					if ( useVertexColors ) cachedMaterial.vertexColors = true;
					if ( useFlatShading ) cachedMaterial.flatShading = true;
					if ( useMorphTargets ) cachedMaterial.morphTargets = true;
					if ( useMorphNormals ) cachedMaterial.morphNormals = true;

					if ( useVertexTangents ) {

						cachedMaterial.vertexTangents = true; // https://github.com/mrdoob/three.js/issues/11438#issuecomment-507003995

						if ( cachedMaterial.normalScale ) cachedMaterial.normalScale.y *= - 1;
						if ( cachedMaterial.clearcoatNormalScale ) cachedMaterial.clearcoatNormalScale.y *= - 1;

					}

					this.cache.add( cacheKey, cachedMaterial );
					this.associations.set( cachedMaterial, this.associations.get( material ) );

				}

				material = cachedMaterial;

			} // workarounds for mesh and geometry


			if ( material.aoMap && geometry.attributes.uv2 === undefined && geometry.attributes.uv !== undefined ) {

				geometry.setAttribute( 'uv2', geometry.attributes.uv );

			}

			mesh.material = material;

		}

		getMaterialType( ) {

			return THREE.MeshStandardMaterial;

		}
		/**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#materials
   * @param {number} materialIndex
   * @return {Promise<Material>}
   */


		loadMaterial( materialIndex ) {

			const parser = this;
			const json = this.json;
			const extensions = this.extensions;
			const materialDef = json.materials[ materialIndex ];
			let materialType;
			const materialParams = {};
			const materialExtensions = materialDef.extensions || {};
			const pending = [];

			if ( materialExtensions[ EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS ] ) {

				const sgExtension = extensions[ EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS ];
				materialType = sgExtension.getMaterialType();
				pending.push( sgExtension.extendParams( materialParams, materialDef, parser ) );

			} else if ( materialExtensions[ EXTENSIONS.KHR_MATERIALS_UNLIT ] ) {

				const kmuExtension = extensions[ EXTENSIONS.KHR_MATERIALS_UNLIT ];
				materialType = kmuExtension.getMaterialType();
				pending.push( kmuExtension.extendParams( materialParams, materialDef, parser ) );

			} else {

				// Specification:
				// https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#metallic-roughness-material
				const metallicRoughness = materialDef.pbrMetallicRoughness || {};
				materialParams.color = new THREE.Color( 1.0, 1.0, 1.0 );
				materialParams.opacity = 1.0;

				if ( Array.isArray( metallicRoughness.baseColorFactor ) ) {

					const array = metallicRoughness.baseColorFactor;
					materialParams.color.fromArray( array );
					materialParams.opacity = array[ 3 ];

				}

				if ( metallicRoughness.baseColorTexture !== undefined ) {

					pending.push( parser.assignTexture( materialParams, 'map', metallicRoughness.baseColorTexture ) );

				}

				materialParams.metalness = metallicRoughness.metallicFactor !== undefined ? metallicRoughness.metallicFactor : 1.0;
				materialParams.roughness = metallicRoughness.roughnessFactor !== undefined ? metallicRoughness.roughnessFactor : 1.0;

				if ( metallicRoughness.metallicRoughnessTexture !== undefined ) {

					pending.push( parser.assignTexture( materialParams, 'metalnessMap', metallicRoughness.metallicRoughnessTexture ) );
					pending.push( parser.assignTexture( materialParams, 'roughnessMap', metallicRoughness.metallicRoughnessTexture ) );

				}

				materialType = this._invokeOne( function ( ext ) {

					return ext.getMaterialType && ext.getMaterialType( materialIndex );

				} );
				pending.push( Promise.all( this._invokeAll( function ( ext ) {

					return ext.extendMaterialParams && ext.extendMaterialParams( materialIndex, materialParams );

				} ) ) );

			}

			if ( materialDef.doubleSided === true ) {

				materialParams.side = THREE.DoubleSide;

			}

			const alphaMode = materialDef.alphaMode || ALPHA_MODES.OPAQUE;

			if ( alphaMode === ALPHA_MODES.BLEND ) {

				materialParams.transparent = true; // See: https://github.com/mrdoob/three.js/issues/17706

				materialParams.depthWrite = false;

			} else {

				materialParams.transparent = false;

				if ( alphaMode === ALPHA_MODES.MASK ) {

					materialParams.alphaTest = materialDef.alphaCutoff !== undefined ? materialDef.alphaCutoff : 0.5;

				}

			}

			if ( materialDef.normalTexture !== undefined && materialType !== THREE.MeshBasicMaterial ) {

				pending.push( parser.assignTexture( materialParams, 'normalMap', materialDef.normalTexture ) ); // https://github.com/mrdoob/three.js/issues/11438#issuecomment-507003995

				materialParams.normalScale = new THREE.Vector2( 1, - 1 );

				if ( materialDef.normalTexture.scale !== undefined ) {

					materialParams.normalScale.set( materialDef.normalTexture.scale, - materialDef.normalTexture.scale );

				}

			}

			if ( materialDef.occlusionTexture !== undefined && materialType !== THREE.MeshBasicMaterial ) {

				pending.push( parser.assignTexture( materialParams, 'aoMap', materialDef.occlusionTexture ) );

				if ( materialDef.occlusionTexture.strength !== undefined ) {

					materialParams.aoMapIntensity = materialDef.occlusionTexture.strength;

				}

			}

			if ( materialDef.emissiveFactor !== undefined && materialType !== THREE.MeshBasicMaterial ) {

				materialParams.emissive = new THREE.Color().fromArray( materialDef.emissiveFactor );

			}

			if ( materialDef.emissiveTexture !== undefined && materialType !== THREE.MeshBasicMaterial ) {

				pending.push( parser.assignTexture( materialParams, 'emissiveMap', materialDef.emissiveTexture ) );

			}

			return Promise.all( pending ).then( function () {

				let material;

				if ( materialType === GLTFMeshStandardSGMaterial ) {

					material = extensions[ EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS ].createMaterial( materialParams );

				} else {

					material = new materialType( materialParams );

				}

				if ( materialDef.name ) material.name = materialDef.name; // baseColorTexture, emissiveTexture, and specularGlossinessTexture use sRGB encoding.

				if ( material.map ) material.map.encoding = THREE.sRGBEncoding;
				if ( material.emissiveMap ) material.emissiveMap.encoding = THREE.sRGBEncoding;
				assignExtrasToUserData( material, materialDef );
				parser.associations.set( material, {
					type: 'materials',
					index: materialIndex
				} );
				if ( materialDef.extensions ) addUnknownExtensionsToUserData( extensions, material, materialDef );
				return material;

			} );

		}
		/** When THREE.Object3D instances are targeted by animation, they need unique names. */


		createUniqueName( originalName ) {

			const sanitizedName = THREE.PropertyBinding.sanitizeNodeName( originalName || '' );
			let name = sanitizedName;

			for ( let i = 1; this.nodeNamesUsed[ name ]; ++ i ) {

				name = sanitizedName + '_' + i;

			}

			this.nodeNamesUsed[ name ] = true;
			return name;

		}
		/**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#geometry
   *
   * Creates BufferGeometries from primitives.
   *
   * @param {Array<GLTF.Primitive>} primitives
   * @return {Promise<Array<BufferGeometry>>}
   */


		loadGeometries( primitives ) {

			const parser = this;
			const extensions = this.extensions;
			const cache = this.primitiveCache;

			function createDracoPrimitive( primitive ) {

				return extensions[ EXTENSIONS.KHR_DRACO_MESH_COMPRESSION ].decodePrimitive( primitive, parser ).then( function ( geometry ) {

					return addPrimitiveAttributes( geometry, primitive, parser );

				} );

			}

			const pending = [];

			for ( let i = 0, il = primitives.length; i < il; i ++ ) {

				const primitive = primitives[ i ];
				const cacheKey = createPrimitiveKey( primitive ); // See if we've already created this geometry

				const cached = cache[ cacheKey ];

				if ( cached ) {

					// Use the cached geometry if it exists
					pending.push( cached.promise );

				} else {

					let geometryPromise;

					if ( primitive.extensions && primitive.extensions[ EXTENSIONS.KHR_DRACO_MESH_COMPRESSION ] ) {

						// Use DRACO geometry if available
						geometryPromise = createDracoPrimitive( primitive );

					} else {

						// Otherwise create a new geometry
						geometryPromise = addPrimitiveAttributes( new THREE.BufferGeometry(), primitive, parser );

					} // Cache this geometry


					cache[ cacheKey ] = {
						primitive: primitive,
						promise: geometryPromise
					};
					pending.push( geometryPromise );

				}

			}

			return Promise.all( pending );

		}
		/**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#meshes
   * @param {number} meshIndex
   * @return {Promise<Group|Mesh|SkinnedMesh>}
   */


		loadMesh( meshIndex ) {

			const parser = this;
			const json = this.json;
			const extensions = this.extensions;
			const meshDef = json.meshes[ meshIndex ];
			const primitives = meshDef.primitives;
			const pending = [];

			for ( let i = 0, il = primitives.length; i < il; i ++ ) {

				const material = primitives[ i ].material === undefined ? createDefaultMaterial( this.cache ) : this.getDependency( 'material', primitives[ i ].material );
				pending.push( material );

			}

			pending.push( parser.loadGeometries( primitives ) );
			return Promise.all( pending ).then( function ( results ) {

				const materials = results.slice( 0, results.length - 1 );
				const geometries = results[ results.length - 1 ];
				const meshes = [];

				for ( let i = 0, il = geometries.length; i < il; i ++ ) {

					const geometry = geometries[ i ];
					const primitive = primitives[ i ]; // 1. create THREE.Mesh

					let mesh;
					const material = materials[ i ];

					if ( primitive.mode === WEBGL_CONSTANTS.TRIANGLES || primitive.mode === WEBGL_CONSTANTS.TRIANGLE_STRIP || primitive.mode === WEBGL_CONSTANTS.TRIANGLE_FAN || primitive.mode === undefined ) {

						// .isSkinnedMesh isn't in glTF spec. See ._markDefs()
						mesh = meshDef.isSkinnedMesh === true ? new THREE.SkinnedMesh( geometry, material ) : new THREE.Mesh( geometry, material );

						if ( mesh.isSkinnedMesh === true && ! mesh.geometry.attributes.skinWeight.normalized ) {

							// we normalize floating point skin weight array to fix malformed assets (see #15319)
							// it's important to skip this for non-float32 data since normalizeSkinWeights assumes non-normalized inputs
							mesh.normalizeSkinWeights();

						}

						if ( primitive.mode === WEBGL_CONSTANTS.TRIANGLE_STRIP ) {

							mesh.geometry = toTrianglesDrawMode( mesh.geometry, THREE.TriangleStripDrawMode );

						} else if ( primitive.mode === WEBGL_CONSTANTS.TRIANGLE_FAN ) {

							mesh.geometry = toTrianglesDrawMode( mesh.geometry, THREE.TriangleFanDrawMode );

						}

					} else if ( primitive.mode === WEBGL_CONSTANTS.LINES ) {

						mesh = new THREE.LineSegments( geometry, material );

					} else if ( primitive.mode === WEBGL_CONSTANTS.LINE_STRIP ) {

						mesh = new THREE.Line( geometry, material );

					} else if ( primitive.mode === WEBGL_CONSTANTS.LINE_LOOP ) {

						mesh = new THREE.LineLoop( geometry, material );

					} else if ( primitive.mode === WEBGL_CONSTANTS.POINTS ) {

						mesh = new THREE.Points( geometry, material );

					} else {

						throw new Error( 'THREE.GLTFLoader: Primitive mode unsupported: ' + primitive.mode );

					}

					if ( Object.keys( mesh.geometry.morphAttributes ).length > 0 ) {

						updateMorphTargets( mesh, meshDef );

					}

					mesh.name = parser.createUniqueName( meshDef.name || 'mesh_' + meshIndex );
					assignExtrasToUserData( mesh, meshDef );
					if ( primitive.extensions ) addUnknownExtensionsToUserData( extensions, mesh, primitive );
					parser.assignFinalMaterial( mesh );
					meshes.push( mesh );

				}

				if ( meshes.length === 1 ) {

					return meshes[ 0 ];

				}

				const group = new THREE.Group();

				for ( let i = 0, il = meshes.length; i < il; i ++ ) {

					group.add( meshes[ i ] );

				}

				return group;

			} );

		}
		/**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#cameras
   * @param {number} cameraIndex
   * @return {Promise<THREE.Camera>}
   */


		loadCamera( cameraIndex ) {

			let camera;
			const cameraDef = this.json.cameras[ cameraIndex ];
			const params = cameraDef[ cameraDef.type ];

			if ( ! params ) {

				console.warn( 'THREE.GLTFLoader: Missing camera parameters.' );
				return;

			}

			if ( cameraDef.type === 'perspective' ) {

				camera = new THREE.PerspectiveCamera( THREE.MathUtils.radToDeg( params.yfov ), params.aspectRatio || 1, params.znear || 1, params.zfar || 2e6 );

			} else if ( cameraDef.type === 'orthographic' ) {

				camera = new THREE.OrthographicCamera( - params.xmag, params.xmag, params.ymag, - params.ymag, params.znear, params.zfar );

			}

			if ( cameraDef.name ) camera.name = this.createUniqueName( cameraDef.name );
			assignExtrasToUserData( camera, cameraDef );
			return Promise.resolve( camera );

		}
		/**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#skins
   * @param {number} skinIndex
   * @return {Promise<Object>}
   */


		loadSkin( skinIndex ) {

			const skinDef = this.json.skins[ skinIndex ];
			const skinEntry = {
				joints: skinDef.joints
			};

			if ( skinDef.inverseBindMatrices === undefined ) {

				return Promise.resolve( skinEntry );

			}

			return this.getDependency( 'accessor', skinDef.inverseBindMatrices ).then( function ( accessor ) {

				skinEntry.inverseBindMatrices = accessor;
				return skinEntry;

			} );

		}
		/**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#animations
   * @param {number} animationIndex
   * @return {Promise<AnimationClip>}
   */


		loadAnimation( animationIndex ) {

			const json = this.json;
			const animationDef = json.animations[ animationIndex ];
			const pendingNodes = [];
			const pendingInputAccessors = [];
			const pendingOutputAccessors = [];
			const pendingSamplers = [];
			const pendingTargets = [];

			for ( let i = 0, il = animationDef.channels.length; i < il; i ++ ) {

				const channel = animationDef.channels[ i ];
				const sampler = animationDef.samplers[ channel.sampler ];
				const target = channel.target;
				const name = target.node !== undefined ? target.node : target.id; // NOTE: target.id is deprecated.

				const input = animationDef.parameters !== undefined ? animationDef.parameters[ sampler.input ] : sampler.input;
				const output = animationDef.parameters !== undefined ? animationDef.parameters[ sampler.output ] : sampler.output;
				pendingNodes.push( this.getDependency( 'node', name ) );
				pendingInputAccessors.push( this.getDependency( 'accessor', input ) );
				pendingOutputAccessors.push( this.getDependency( 'accessor', output ) );
				pendingSamplers.push( sampler );
				pendingTargets.push( target );

			}

			return Promise.all( [ Promise.all( pendingNodes ), Promise.all( pendingInputAccessors ), Promise.all( pendingOutputAccessors ), Promise.all( pendingSamplers ), Promise.all( pendingTargets ) ] ).then( function ( dependencies ) {

				const nodes = dependencies[ 0 ];
				const inputAccessors = dependencies[ 1 ];
				const outputAccessors = dependencies[ 2 ];
				const samplers = dependencies[ 3 ];
				const targets = dependencies[ 4 ];
				const tracks = [];

				for ( let i = 0, il = nodes.length; i < il; i ++ ) {

					const node = nodes[ i ];
					const inputAccessor = inputAccessors[ i ];
					const outputAccessor = outputAccessors[ i ];
					const sampler = samplers[ i ];
					const target = targets[ i ];
					if ( node === undefined ) continue;
					node.updateMatrix();
					node.matrixAutoUpdate = true;
					let TypedKeyframeTrack;

					switch ( PATH_PROPERTIES[ target.path ] ) {

						case PATH_PROPERTIES.weights:
							TypedKeyframeTrack = THREE.NumberKeyframeTrack;
							break;

						case PATH_PROPERTIES.rotation:
							TypedKeyframeTrack = THREE.QuaternionKeyframeTrack;
							break;

						case PATH_PROPERTIES.position:
						case PATH_PROPERTIES.scale:
						default:
							TypedKeyframeTrack = THREE.VectorKeyframeTrack;
							break;

					}

					const targetName = node.name ? node.name : node.uuid;
					const interpolation = sampler.interpolation !== undefined ? INTERPOLATION[ sampler.interpolation ] : THREE.InterpolateLinear;
					const targetNames = [];

					if ( PATH_PROPERTIES[ target.path ] === PATH_PROPERTIES.weights ) {

						// Node may be a THREE.Group (glTF mesh with several primitives) or a THREE.Mesh.
						node.traverse( function ( object ) {

							if ( object.isMesh === true && object.morphTargetInfluences ) {

								targetNames.push( object.name ? object.name : object.uuid );

							}

						} );

					} else {

						targetNames.push( targetName );

					}

					let outputArray = outputAccessor.array;

					if ( outputAccessor.normalized ) {

						const scale = getNormalizedComponentScale( outputArray.constructor );
						const scaled = new Float32Array( outputArray.length );

						for ( let j = 0, jl = outputArray.length; j < jl; j ++ ) {

							scaled[ j ] = outputArray[ j ] * scale;

						}

						outputArray = scaled;

					}

					for ( let j = 0, jl = targetNames.length; j < jl; j ++ ) {

						const track = new TypedKeyframeTrack( targetNames[ j ] + '.' + PATH_PROPERTIES[ target.path ], inputAccessor.array, outputArray, interpolation ); // Override interpolation with custom factory method.

						if ( sampler.interpolation === 'CUBICSPLINE' ) {

							track.createInterpolant = function InterpolantFactoryMethodGLTFCubicSpline( result ) {

								// A CUBICSPLINE keyframe in glTF has three output values for each input value,
								// representing inTangent, splineVertex, and outTangent. As a result, track.getValueSize()
								// must be divided by three to get the interpolant's sampleSize argument.
								return new GLTFCubicSplineInterpolant( this.times, this.values, this.getValueSize() / 3, result );

							}; // Mark as CUBICSPLINE. `track.getInterpolation()` doesn't support custom interpolants.


							track.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline = true;

						}

						tracks.push( track );

					}

				}

				const name = animationDef.name ? animationDef.name : 'animation_' + animationIndex;
				return new THREE.AnimationClip( name, undefined, tracks );

			} );

		}

		createNodeMesh( nodeIndex ) {

			const json = this.json;
			const parser = this;
			const nodeDef = json.nodes[ nodeIndex ];
			if ( nodeDef.mesh === undefined ) return null;
			return parser.getDependency( 'mesh', nodeDef.mesh ).then( function ( mesh ) {

				const node = parser._getNodeRef( parser.meshCache, nodeDef.mesh, mesh ); // if weights are provided on the node, override weights on the mesh.


				if ( nodeDef.weights !== undefined ) {

					node.traverse( function ( o ) {

						if ( ! o.isMesh ) return;

						for ( let i = 0, il = nodeDef.weights.length; i < il; i ++ ) {

							o.morphTargetInfluences[ i ] = nodeDef.weights[ i ];

						}

					} );

				}

				return node;

			} );

		}
		/**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#nodes-and-hierarchy
   * @param {number} nodeIndex
   * @return {Promise<Object3D>}
   */


		loadNode( nodeIndex ) {

			const json = this.json;
			const extensions = this.extensions;
			const parser = this;
			const nodeDef = json.nodes[ nodeIndex ]; // reserve node's name before its dependencies, so the root has the intended name.

			const nodeName = nodeDef.name ? parser.createUniqueName( nodeDef.name ) : '';
			return function () {

				const pending = [];

				const meshPromise = parser._invokeOne( function ( ext ) {

					return ext.createNodeMesh && ext.createNodeMesh( nodeIndex );

				} );

				if ( meshPromise ) {

					pending.push( meshPromise );

				}

				if ( nodeDef.camera !== undefined ) {

					pending.push( parser.getDependency( 'camera', nodeDef.camera ).then( function ( camera ) {

						return parser._getNodeRef( parser.cameraCache, nodeDef.camera, camera );

					} ) );

				}

				parser._invokeAll( function ( ext ) {

					return ext.createNodeAttachment && ext.createNodeAttachment( nodeIndex );

				} ).forEach( function ( promise ) {

					pending.push( promise );

				} );

				return Promise.all( pending );

			}().then( function ( objects ) {

				let node; // .isBone isn't in glTF spec. See ._markDefs

				if ( nodeDef.isBone === true ) {

					node = new THREE.Bone();

				} else if ( objects.length > 1 ) {

					node = new THREE.Group();

				} else if ( objects.length === 1 ) {

					node = objects[ 0 ];

				} else {

					node = new THREE.Object3D();

				}

				if ( node !== objects[ 0 ] ) {

					for ( let i = 0, il = objects.length; i < il; i ++ ) {

						node.add( objects[ i ] );

					}

				}

				if ( nodeDef.name ) {

					node.userData.name = nodeDef.name;
					node.name = nodeName;

				}

				assignExtrasToUserData( node, nodeDef );
				if ( nodeDef.extensions ) addUnknownExtensionsToUserData( extensions, node, nodeDef );

				if ( nodeDef.matrix !== undefined ) {

					const matrix = new THREE.Matrix4();
					matrix.fromArray( nodeDef.matrix );
					node.applyMatrix4( matrix );

				} else {

					if ( nodeDef.translation !== undefined ) {

						node.position.fromArray( nodeDef.translation );

					}

					if ( nodeDef.rotation !== undefined ) {

						node.quaternion.fromArray( nodeDef.rotation );

					}

					if ( nodeDef.scale !== undefined ) {

						node.scale.fromArray( nodeDef.scale );

					}

				}

				parser.associations.set( node, {
					type: 'nodes',
					index: nodeIndex
				} );
				return node;

			} );

		}
		/**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#scenes
   * @param {number} sceneIndex
   * @return {Promise<Group>}
   */


		loadScene( sceneIndex ) {

			const json = this.json;
			const extensions = this.extensions;
			const sceneDef = this.json.scenes[ sceneIndex ];
			const parser = this; // THREE.Loader returns THREE.Group, not Scene.
			// See: https://github.com/mrdoob/three.js/issues/18342#issuecomment-578981172

			const scene = new THREE.Group();
			if ( sceneDef.name ) scene.name = parser.createUniqueName( sceneDef.name );
			assignExtrasToUserData( scene, sceneDef );
			if ( sceneDef.extensions ) addUnknownExtensionsToUserData( extensions, scene, sceneDef );
			const nodeIds = sceneDef.nodes || [];
			const pending = [];

			for ( let i = 0, il = nodeIds.length; i < il; i ++ ) {

				pending.push( buildNodeHierachy( nodeIds[ i ], scene, json, parser ) );

			}

			return Promise.all( pending ).then( function () {

				return scene;

			} );

		}

	}

	function buildNodeHierachy( nodeId, parentObject, json, parser ) {

		const nodeDef = json.nodes[ nodeId ];
		return parser.getDependency( 'node', nodeId ).then( function ( node ) {

			if ( nodeDef.skin === undefined ) return node; // build skeleton here as well

			let skinEntry;
			return parser.getDependency( 'skin', nodeDef.skin ).then( function ( skin ) {

				skinEntry = skin;
				const pendingJoints = [];

				for ( let i = 0, il = skinEntry.joints.length; i < il; i ++ ) {

					pendingJoints.push( parser.getDependency( 'node', skinEntry.joints[ i ] ) );

				}

				return Promise.all( pendingJoints );

			} ).then( function ( jointNodes ) {

				node.traverse( function ( mesh ) {

					if ( ! mesh.isMesh ) return;
					const bones = [];
					const boneInverses = [];

					for ( let j = 0, jl = jointNodes.length; j < jl; j ++ ) {

						const jointNode = jointNodes[ j ];

						if ( jointNode ) {

							bones.push( jointNode );
							const mat = new THREE.Matrix4();

							if ( skinEntry.inverseBindMatrices !== undefined ) {

								mat.fromArray( skinEntry.inverseBindMatrices.array, j * 16 );

							}

							boneInverses.push( mat );

						} else {

							console.warn( 'THREE.GLTFLoader: Joint "%s" could not be found.', skinEntry.joints[ j ] );

						}

					}

					mesh.bind( new THREE.Skeleton( bones, boneInverses ), mesh.matrixWorld );

				} );
				return node;

			} );

		} ).then( function ( node ) {

			// build node hierachy
			parentObject.add( node );
			const pending = [];

			if ( nodeDef.children ) {

				const children = nodeDef.children;

				for ( let i = 0, il = children.length; i < il; i ++ ) {

					const child = children[ i ];
					pending.push( buildNodeHierachy( child, node, json, parser ) );

				}

			}

			return Promise.all( pending );

		} );

	}
	/**
 * @param {BufferGeometry} geometry
 * @param {GLTF.Primitive} primitiveDef
 * @param {GLTFParser} parser
 */


	function computeBounds( geometry, primitiveDef, parser ) {

		const attributes = primitiveDef.attributes;
		const box = new THREE.Box3();

		if ( attributes.POSITION !== undefined ) {

			const accessor = parser.json.accessors[ attributes.POSITION ];
			const min = accessor.min;
			const max = accessor.max; // glTF requires 'min' and 'max', but VRM (which extends glTF) currently ignores that requirement.

			if ( min !== undefined && max !== undefined ) {

				box.set( new THREE.Vector3( min[ 0 ], min[ 1 ], min[ 2 ] ), new THREE.Vector3( max[ 0 ], max[ 1 ], max[ 2 ] ) );

				if ( accessor.normalized ) {

					const boxScale = getNormalizedComponentScale( WEBGL_COMPONENT_TYPES[ accessor.componentType ] );
					box.min.multiplyScalar( boxScale );
					box.max.multiplyScalar( boxScale );

				}

			} else {

				console.warn( 'THREE.GLTFLoader: Missing min/max properties for accessor POSITION.' );
				return;

			}

		} else {

			return;

		}

		const targets = primitiveDef.targets;

		if ( targets !== undefined ) {

			const maxDisplacement = new THREE.Vector3();
			const vector = new THREE.Vector3();

			for ( let i = 0, il = targets.length; i < il; i ++ ) {

				const target = targets[ i ];

				if ( target.POSITION !== undefined ) {

					const accessor = parser.json.accessors[ target.POSITION ];
					const min = accessor.min;
					const max = accessor.max; // glTF requires 'min' and 'max', but VRM (which extends glTF) currently ignores that requirement.

					if ( min !== undefined && max !== undefined ) {

						// we need to get max of absolute components because target weight is [-1,1]
						vector.setX( Math.max( Math.abs( min[ 0 ] ), Math.abs( max[ 0 ] ) ) );
						vector.setY( Math.max( Math.abs( min[ 1 ] ), Math.abs( max[ 1 ] ) ) );
						vector.setZ( Math.max( Math.abs( min[ 2 ] ), Math.abs( max[ 2 ] ) ) );

						if ( accessor.normalized ) {

							const boxScale = getNormalizedComponentScale( WEBGL_COMPONENT_TYPES[ accessor.componentType ] );
							vector.multiplyScalar( boxScale );

						} // Note: this assumes that the sum of all weights is at most 1. This isn't quite correct - it's more conservative
						// to assume that each target can have a max weight of 1. However, for some use cases - notably, when morph targets
						// are used to implement key-frame animations and as such only two are active at a time - this results in very large
						// boxes. So for now we make a box that's sometimes a touch too small but is hopefully mostly of reasonable size.


						maxDisplacement.max( vector );

					} else {

						console.warn( 'THREE.GLTFLoader: Missing min/max properties for accessor POSITION.' );

					}

				}

			} // As per comment above this box isn't conservative, but has a reasonable size for a very large number of morph targets.


			box.expandByVector( maxDisplacement );

		}

		geometry.boundingBox = box;
		const sphere = new THREE.Sphere();
		box.getCenter( sphere.center );
		sphere.radius = box.min.distanceTo( box.max ) / 2;
		geometry.boundingSphere = sphere;

	}
	/**
 * @param {BufferGeometry} geometry
 * @param {GLTF.Primitive} primitiveDef
 * @param {GLTFParser} parser
 * @return {Promise<BufferGeometry>}
 */


	function addPrimitiveAttributes( geometry, primitiveDef, parser ) {

		const attributes = primitiveDef.attributes;
		const pending = [];

		function assignAttributeAccessor( accessorIndex, attributeName ) {

			return parser.getDependency( 'accessor', accessorIndex ).then( function ( accessor ) {

				geometry.setAttribute( attributeName, accessor );

			} );

		}

		for ( const gltfAttributeName in attributes ) {

			const threeAttributeName = ATTRIBUTES[ gltfAttributeName ] || gltfAttributeName.toLowerCase(); // Skip attributes already provided by e.g. Draco extension.

			if ( threeAttributeName in geometry.attributes ) continue;
			pending.push( assignAttributeAccessor( attributes[ gltfAttributeName ], threeAttributeName ) );

		}

		if ( primitiveDef.indices !== undefined && ! geometry.index ) {

			const accessor = parser.getDependency( 'accessor', primitiveDef.indices ).then( function ( accessor ) {

				geometry.setIndex( accessor );

			} );
			pending.push( accessor );

		}

		assignExtrasToUserData( geometry, primitiveDef );
		computeBounds( geometry, primitiveDef, parser );
		return Promise.all( pending ).then( function () {

			return primitiveDef.targets !== undefined ? addMorphTargets( geometry, primitiveDef.targets, parser ) : geometry;

		} );

	}
	/**
 * @param {BufferGeometry} geometry
 * @param {Number} drawMode
 * @return {BufferGeometry}
 */


	function toTrianglesDrawMode( geometry, drawMode ) {

		let index = geometry.getIndex(); // generate index if not present

		if ( index === null ) {

			const indices = [];
			const position = geometry.getAttribute( 'position' );

			if ( position !== undefined ) {

				for ( let i = 0; i < position.count; i ++ ) {

					indices.push( i );

				}

				geometry.setIndex( indices );
				index = geometry.getIndex();

			} else {

				console.error( 'THREE.GLTFLoader.toTrianglesDrawMode(): Undefined position attribute. Processing not possible.' );
				return geometry;

			}

		} //


		const numberOfTriangles = index.count - 2;
		const newIndices = [];

		if ( drawMode === THREE.TriangleFanDrawMode ) {

			// gl.TRIANGLE_FAN
			for ( let i = 1; i <= numberOfTriangles; i ++ ) {

				newIndices.push( index.getX( 0 ) );
				newIndices.push( index.getX( i ) );
				newIndices.push( index.getX( i + 1 ) );

			}

		} else {

			// gl.TRIANGLE_STRIP
			for ( let i = 0; i < numberOfTriangles; i ++ ) {

				if ( i % 2 === 0 ) {

					newIndices.push( index.getX( i ) );
					newIndices.push( index.getX( i + 1 ) );
					newIndices.push( index.getX( i + 2 ) );

				} else {

					newIndices.push( index.getX( i + 2 ) );
					newIndices.push( index.getX( i + 1 ) );
					newIndices.push( index.getX( i ) );

				}

			}

		}

		if ( newIndices.length / 3 !== numberOfTriangles ) {

			console.error( 'THREE.GLTFLoader.toTrianglesDrawMode(): Unable to generate correct amount of triangles.' );

		} // build final geometry


		const newGeometry = geometry.clone();
		newGeometry.setIndex( newIndices );
		return newGeometry;

	}

	THREE.GLTFLoader = GLTFLoader;

} )();
( function () {

	class SkeletonUtils {

		static retarget( target, source, options = {} ) {

			const pos = new THREE.Vector3(),
				quat = new THREE.Quaternion(),
				scale = new THREE.Vector3(),
				bindBoneMatrix = new THREE.Matrix4(),
				relativeMatrix = new THREE.Matrix4(),
				globalMatrix = new THREE.Matrix4();
			options.preserveMatrix = options.preserveMatrix !== undefined ? options.preserveMatrix : true;
			options.preservePosition = options.preservePosition !== undefined ? options.preservePosition : true;
			options.preserveHipPosition = options.preserveHipPosition !== undefined ? options.preserveHipPosition : false;
			options.useTargetMatrix = options.useTargetMatrix !== undefined ? options.useTargetMatrix : false;
			options.hip = options.hip !== undefined ? options.hip : 'hip';
			options.names = options.names || {};
			const sourceBones = source.isObject3D ? source.skeleton.bones : this.getBones( source ),
				bones = target.isObject3D ? target.skeleton.bones : this.getBones( target );
			let bindBones, bone, name, boneTo, bonesPosition; // reset bones

			if ( target.isObject3D ) {

				target.skeleton.pose();

			} else {

				options.useTargetMatrix = true;
				options.preserveMatrix = false;

			}

			if ( options.preservePosition ) {

				bonesPosition = [];

				for ( let i = 0; i < bones.length; i ++ ) {

					bonesPosition.push( bones[ i ].position.clone() );

				}

			}

			if ( options.preserveMatrix ) {

				// reset matrix
				target.updateMatrixWorld();
				target.matrixWorld.identity(); // reset children matrix

				for ( let i = 0; i < target.children.length; ++ i ) {

					target.children[ i ].updateMatrixWorld( true );

				}

			}

			if ( options.offsets ) {

				bindBones = [];

				for ( let i = 0; i < bones.length; ++ i ) {

					bone = bones[ i ];
					name = options.names[ bone.name ] || bone.name;

					if ( options.offsets && options.offsets[ name ] ) {

						bone.matrix.multiply( options.offsets[ name ] );
						bone.matrix.decompose( bone.position, bone.quaternion, bone.scale );
						bone.updateMatrixWorld();

					}

					bindBones.push( bone.matrixWorld.clone() );

				}

			}

			for ( let i = 0; i < bones.length; ++ i ) {

				bone = bones[ i ];
				name = options.names[ bone.name ] || bone.name;
				boneTo = this.getBoneByName( name, sourceBones );
				globalMatrix.copy( bone.matrixWorld );

				if ( boneTo ) {

					boneTo.updateMatrixWorld();

					if ( options.useTargetMatrix ) {

						relativeMatrix.copy( boneTo.matrixWorld );

					} else {

						relativeMatrix.copy( target.matrixWorld ).invert();
						relativeMatrix.multiply( boneTo.matrixWorld );

					} // ignore scale to extract rotation


					scale.setFromMatrixScale( relativeMatrix );
					relativeMatrix.scale( scale.set( 1 / scale.x, 1 / scale.y, 1 / scale.z ) ); // apply to global matrix

					globalMatrix.makeRotationFromQuaternion( quat.setFromRotationMatrix( relativeMatrix ) );

					if ( target.isObject3D ) {

						const boneIndex = bones.indexOf( bone ),
							wBindMatrix = bindBones ? bindBones[ boneIndex ] : bindBoneMatrix.copy( target.skeleton.boneInverses[ boneIndex ] ).invert();
						globalMatrix.multiply( wBindMatrix );

					}

					globalMatrix.copyPosition( relativeMatrix );

				}

				if ( bone.parent && bone.parent.isBone ) {

					bone.matrix.copy( bone.parent.matrixWorld ).invert();
					bone.matrix.multiply( globalMatrix );

				} else {

					bone.matrix.copy( globalMatrix );

				}

				if ( options.preserveHipPosition && name === options.hip ) {

					bone.matrix.setPosition( pos.set( 0, bone.position.y, 0 ) );

				}

				bone.matrix.decompose( bone.position, bone.quaternion, bone.scale );
				bone.updateMatrixWorld();

			}

			if ( options.preservePosition ) {

				for ( let i = 0; i < bones.length; ++ i ) {

					bone = bones[ i ];
					name = options.names[ bone.name ] || bone.name;

					if ( name !== options.hip ) {

						bone.position.copy( bonesPosition[ i ] );

					}

				}

			}

			if ( options.preserveMatrix ) {

				// restore matrix
				target.updateMatrixWorld( true );

			}

		}

		static retargetClip( target, source, clip, options = {} ) {

			options.useFirstFramePosition = options.useFirstFramePosition !== undefined ? options.useFirstFramePosition : false;
			options.fps = options.fps !== undefined ? options.fps : 30;
			options.names = options.names || [];

			if ( ! source.isObject3D ) {

				source = this.getHelperFromSkeleton( source );

			}

			const numFrames = Math.round( clip.duration * ( options.fps / 1000 ) * 1000 ),
				delta = 1 / options.fps,
				convertedTracks = [],
				mixer = new THREE.AnimationMixer( source ),
				bones = this.getBones( target.skeleton ),
				boneDatas = [];
			let positionOffset, bone, boneTo, boneData, name;
			mixer.clipAction( clip ).play();
			mixer.update( 0 );
			source.updateMatrixWorld();

			for ( let i = 0; i < numFrames; ++ i ) {

				const time = i * delta;
				this.retarget( target, source, options );

				for ( let j = 0; j < bones.length; ++ j ) {

					name = options.names[ bones[ j ].name ] || bones[ j ].name;
					boneTo = this.getBoneByName( name, source.skeleton );

					if ( boneTo ) {

						bone = bones[ j ];
						boneData = boneDatas[ j ] = boneDatas[ j ] || {
							bone: bone
						};

						if ( options.hip === name ) {

							if ( ! boneData.pos ) {

								boneData.pos = {
									times: new Float32Array( numFrames ),
									values: new Float32Array( numFrames * 3 )
								};

							}

							if ( options.useFirstFramePosition ) {

								if ( i === 0 ) {

									positionOffset = bone.position.clone();

								}

								bone.position.sub( positionOffset );

							}

							boneData.pos.times[ i ] = time;
							bone.position.toArray( boneData.pos.values, i * 3 );

						}

						if ( ! boneData.quat ) {

							boneData.quat = {
								times: new Float32Array( numFrames ),
								values: new Float32Array( numFrames * 4 )
							};

						}

						boneData.quat.times[ i ] = time;
						bone.quaternion.toArray( boneData.quat.values, i * 4 );

					}

				}

				mixer.update( delta );
				source.updateMatrixWorld();

			}

			for ( let i = 0; i < boneDatas.length; ++ i ) {

				boneData = boneDatas[ i ];

				if ( boneData ) {

					if ( boneData.pos ) {

						convertedTracks.push( new THREE.VectorKeyframeTrack( '.bones[' + boneData.bone.name + '].position', boneData.pos.times, boneData.pos.values ) );

					}

					convertedTracks.push( new THREE.QuaternionKeyframeTrack( '.bones[' + boneData.bone.name + '].quaternion', boneData.quat.times, boneData.quat.values ) );

				}

			}

			mixer.uncacheAction( clip );
			return new THREE.AnimationClip( clip.name, - 1, convertedTracks );

		}

		static getHelperFromSkeleton( skeleton ) {

			const source = new THREE.SkeletonHelper( skeleton.bones[ 0 ] );
			source.skeleton = skeleton;
			return source;

		}

		static getSkeletonOffsets( target, source, options = {} ) {

			const targetParentPos = new THREE.Vector3(),
				targetPos = new THREE.Vector3(),
				sourceParentPos = new THREE.Vector3(),
				sourcePos = new THREE.Vector3(),
				targetDir = new THREE.Vector2(),
				sourceDir = new THREE.Vector2();
			options.hip = options.hip !== undefined ? options.hip : 'hip';
			options.names = options.names || {};

			if ( ! source.isObject3D ) {

				source = this.getHelperFromSkeleton( source );

			}

			const nameKeys = Object.keys( options.names ),
				nameValues = Object.values( options.names ),
				sourceBones = source.isObject3D ? source.skeleton.bones : this.getBones( source ),
				bones = target.isObject3D ? target.skeleton.bones : this.getBones( target ),
				offsets = [];
			let bone, boneTo, name, i;
			target.skeleton.pose();

			for ( i = 0; i < bones.length; ++ i ) {

				bone = bones[ i ];
				name = options.names[ bone.name ] || bone.name;
				boneTo = this.getBoneByName( name, sourceBones );

				if ( boneTo && name !== options.hip ) {

					const boneParent = this.getNearestBone( bone.parent, nameKeys ),
						boneToParent = this.getNearestBone( boneTo.parent, nameValues );
					boneParent.updateMatrixWorld();
					boneToParent.updateMatrixWorld();
					targetParentPos.setFromMatrixPosition( boneParent.matrixWorld );
					targetPos.setFromMatrixPosition( bone.matrixWorld );
					sourceParentPos.setFromMatrixPosition( boneToParent.matrixWorld );
					sourcePos.setFromMatrixPosition( boneTo.matrixWorld );
					targetDir.subVectors( new THREE.Vector2( targetPos.x, targetPos.y ), new THREE.Vector2( targetParentPos.x, targetParentPos.y ) ).normalize();
					sourceDir.subVectors( new THREE.Vector2( sourcePos.x, sourcePos.y ), new THREE.Vector2( sourceParentPos.x, sourceParentPos.y ) ).normalize();
					const laterialAngle = targetDir.angle() - sourceDir.angle();
					const offset = new THREE.Matrix4().makeRotationFromEuler( new THREE.Euler( 0, 0, laterialAngle ) );
					bone.matrix.multiply( offset );
					bone.matrix.decompose( bone.position, bone.quaternion, bone.scale );
					bone.updateMatrixWorld();
					offsets[ name ] = offset;

				}

			}

			return offsets;

		}

		static renameBones( skeleton, names ) {

			const bones = this.getBones( skeleton );

			for ( let i = 0; i < bones.length; ++ i ) {

				const bone = bones[ i ];

				if ( names[ bone.name ] ) {

					bone.name = names[ bone.name ];

				}

			}

			return this;

		}

		static getBones( skeleton ) {

			return Array.isArray( skeleton ) ? skeleton : skeleton.bones;

		}

		static getBoneByName( name, skeleton ) {

			for ( let i = 0, bones = this.getBones( skeleton ); i < bones.length; i ++ ) {

				if ( name === bones[ i ].name ) return bones[ i ];

			}

		}

		static getNearestBone( bone, names ) {

			while ( bone.isBone ) {

				if ( names.indexOf( bone.name ) !== - 1 ) {

					return bone;

				}

				bone = bone.parent;

			}

		}

		static findBoneTrackData( name, tracks ) {

			const regexp = /\[(.*)\]\.(.*)/,
				result = {
					name: name
				};

			for ( let i = 0; i < tracks.length; ++ i ) {

				// 1 is track name
				// 2 is track type
				const trackData = regexp.exec( tracks[ i ].name );

				if ( trackData && name === trackData[ 1 ] ) {

					result[ trackData[ 2 ] ] = i;

				}

			}

			return result;

		}

		static getEqualsBonesNames( skeleton, targetSkeleton ) {

			const sourceBones = this.getBones( skeleton ),
				targetBones = this.getBones( targetSkeleton ),
				bones = [];

			search: for ( let i = 0; i < sourceBones.length; i ++ ) {

				const boneName = sourceBones[ i ].name;

				for ( let j = 0; j < targetBones.length; j ++ ) {

					if ( boneName === targetBones[ j ].name ) {

						bones.push( boneName );
						continue search;

					}

				}

			}

			return bones;

		}

		static clone( source ) {

			const sourceLookup = new Map();
			const cloneLookup = new Map();
			const clone = source.clone();
			parallelTraverse( source, clone, function ( sourceNode, clonedNode ) {

				sourceLookup.set( clonedNode, sourceNode );
				cloneLookup.set( sourceNode, clonedNode );

			} );
			clone.traverse( function ( node ) {

				if ( ! node.isSkinnedMesh ) return;
				const clonedMesh = node;
				const sourceMesh = sourceLookup.get( node );
				const sourceBones = sourceMesh.skeleton.bones;
				clonedMesh.skeleton = sourceMesh.skeleton.clone();
				clonedMesh.bindMatrix.copy( sourceMesh.bindMatrix );
				clonedMesh.skeleton.bones = sourceBones.map( function ( bone ) {

					return cloneLookup.get( bone );

				} );
				clonedMesh.bind( clonedMesh.skeleton, clonedMesh.bindMatrix );

			} );
			return clone;

		}

	}

	function parallelTraverse( a, b, callback ) {

		callback( a, b );

		for ( let i = 0; i < a.children.length; i ++ ) {

			parallelTraverse( a.children[ i ], b.children[ i ], callback );

		}

	}

	THREE.SkeletonUtils = SkeletonUtils;

} )();
;
/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.6.9
*/
!function(f){typeof module!='undefined'&&typeof exports=='object'?module.exports=f():typeof define!='undefined'&&define.amd?define(['fflate',f]):(typeof self!='undefined'?self:this).fflate=f()}(function(){var _e={};"use strict";var t=(typeof module!='undefined'&&typeof exports=='object'?function(_f){"use strict";var e,t=";var __w=require('worker_threads');__w.parentPort.on('message',function(m){onmessage({data:m})}),postMessage=function(m,t){__w.parentPort.postMessage(m,t)},close=process.exit;self=global";try{e=require("worker_threads").Worker}catch(e){}exports.default=e?function(r,n,o,a,s){var u=!1,i=new e(r+t,{eval:!0}).on("error",(function(e){return s(e,null)})).on("message",(function(e){return s(null,e)})).on("exit",(function(e){e&&!u&&s(Error("exited with code "+e),null)}));return i.postMessage(o,a),i.terminate=function(){return u=!0,e.prototype.terminate.call(i)},i}:function(e,t,r,n,o){setImmediate((function(){return o(Error("async operations unsupported - update to Node 12+ (or Node 10-11 with the --experimental-worker CLI flag)"),null)}));var a=function(){};return{terminate:a,postMessage:a}};return _f}:function(_f){"use strict";var e={},r=function(e){return URL.createObjectURL(new Blob([e],{type:"text/javascript"}))},t=function(e){return new Worker(e)};try{URL.revokeObjectURL(r(""))}catch(e){r=function(e){return"data:application/javascript;charset=UTF-8,"+encodeURI(e)},t=function(e){return new Worker(e,{type:"module"})}}_f.default=function(n,o,u,a,c){var i=t(e[o]||(e[o]=r(n)));return i.onerror=function(e){return c(e.error,null)},i.onmessage=function(e){return c(null,e.data)},i.postMessage(u,a),i};return _f})({}),n=Uint8Array,r=Uint16Array,e=Uint32Array,i=new n([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),o=new n([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),a=new n([16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15]),s=function(t,n){for(var i=new r(31),o=0;o<31;++o)i[o]=n+=1<<t[o-1];var a=new e(i[30]);for(o=1;o<30;++o)for(var s=i[o];s<i[o+1];++s)a[s]=s-i[o]<<5|o;return[i,a]},f=s(i,2),u=f[0],h=f[1];u[28]=258,h[258]=28;for(var c=s(o,0),l=c[0],p=c[1],v=new r(32768),d=0;d<32768;++d){var g=(43690&d)>>>1|(21845&d)<<1;v[d]=((65280&(g=(61680&(g=(52428&g)>>>2|(13107&g)<<2))>>>4|(3855&g)<<4))>>>8|(255&g)<<8)>>>1}var w=function(t,n,e){for(var i=t.length,o=0,a=new r(n);o<i;++o)++a[t[o]-1];var s,f=new r(n);for(o=0;o<n;++o)f[o]=f[o-1]+a[o-1]<<1;if(e){s=new r(1<<n);var u=15-n;for(o=0;o<i;++o)if(t[o])for(var h=o<<4|t[o],c=n-t[o],l=f[t[o]-1]++<<c,p=l|(1<<c)-1;l<=p;++l)s[v[l]>>>u]=h}else for(s=new r(i),o=0;o<i;++o)t[o]&&(s[o]=v[f[t[o]-1]++]>>>15-t[o]);return s},y=new n(288);for(d=0;d<144;++d)y[d]=8;for(d=144;d<256;++d)y[d]=9;for(d=256;d<280;++d)y[d]=7;for(d=280;d<288;++d)y[d]=8;var m=new n(32);for(d=0;d<32;++d)m[d]=5;var b=w(y,9,0),x=w(y,9,1),z=w(m,5,0),k=w(m,5,1),M=function(t){for(var n=t[0],r=1;r<t.length;++r)t[r]>n&&(n=t[r]);return n},A=function(t,n,r){var e=n/8|0;return(t[e]|t[e+1]<<8)>>(7&n)&r},S=function(t,n){var r=n/8|0;return(t[r]|t[r+1]<<8|t[r+2]<<16)>>(7&n)},D=function(t){return(t/8|0)+(7&t&&1)},C=function(t,i,o){(null==i||i<0)&&(i=0),(null==o||o>t.length)&&(o=t.length);var a=new(t instanceof r?r:t instanceof e?e:n)(o-i);return a.set(t.subarray(i,o)),a},U=function(t,r,e){var s=t.length;if(!s||e&&!e.l&&s<5)return r||new n(0);var f=!r||e,h=!e||e.i;e||(e={}),r||(r=new n(3*s));var c=function(t){var e=r.length;if(t>e){var i=new n(Math.max(2*e,t));i.set(r),r=i}},p=e.f||0,v=e.p||0,d=e.b||0,g=e.l,y=e.d,m=e.m,b=e.n,z=8*s;do{if(!g){e.f=p=A(t,v,1);var U=A(t,v+1,3);if(v+=3,!U){var O=t[(Y=D(v)+4)-4]|t[Y-3]<<8,T=Y+O;if(T>s){if(h)throw"unexpected EOF";break}f&&c(d+O),r.set(t.subarray(Y,T),d),e.b=d+=O,e.p=v=8*T;continue}if(1==U)g=x,y=k,m=9,b=5;else{if(2!=U)throw"invalid block type";var Z=A(t,v,31)+257,I=A(t,v+10,15)+4,F=Z+A(t,v+5,31)+1;v+=14;for(var E=new n(F),G=new n(19),P=0;P<I;++P)G[a[P]]=A(t,v+3*P,7);v+=3*I;var j=M(G),q=(1<<j)-1,H=w(G,j,1);for(P=0;P<F;){var Y,B=H[A(t,v,q)];if(v+=15&B,(Y=B>>>4)<16)E[P++]=Y;else{var J=0,K=0;for(16==Y?(K=3+A(t,v,3),v+=2,J=E[P-1]):17==Y?(K=3+A(t,v,7),v+=3):18==Y&&(K=11+A(t,v,127),v+=7);K--;)E[P++]=J}}var L=E.subarray(0,Z),N=E.subarray(Z);m=M(L),b=M(N),g=w(L,m,1),y=w(N,b,1)}if(v>z){if(h)throw"unexpected EOF";break}}f&&c(d+131072);for(var Q=(1<<m)-1,R=(1<<b)-1,V=v;;V=v){var W=(J=g[S(t,v)&Q])>>>4;if((v+=15&J)>z){if(h)throw"unexpected EOF";break}if(!J)throw"invalid length/literal";if(W<256)r[d++]=W;else{if(256==W){V=v,g=null;break}var X=W-254;W>264&&(X=A(t,v,(1<<(tt=i[P=W-257]))-1)+u[P],v+=tt);var $=y[S(t,v)&R],_=$>>>4;if(!$)throw"invalid distance";if(v+=15&$,N=l[_],_>3){var tt=o[_];N+=S(t,v)&(1<<tt)-1,v+=tt}if(v>z){if(h)throw"unexpected EOF";break}f&&c(d+131072);for(var nt=d+X;d<nt;d+=4)r[d]=r[d-N],r[d+1]=r[d+1-N],r[d+2]=r[d+2-N],r[d+3]=r[d+3-N];d=nt}}e.l=g,e.p=V,e.b=d,g&&(p=1,e.m=m,e.d=y,e.n=b)}while(!p);return d==r.length?r:C(r,0,d)},O=function(t,n,r){var e=n/8|0;t[e]|=r<<=7&n,t[e+1]|=r>>>8},T=function(t,n,r){var e=n/8|0;t[e]|=r<<=7&n,t[e+1]|=r>>>8,t[e+2]|=r>>>16},Z=function(t,e){for(var i=[],o=0;o<t.length;++o)t[o]&&i.push({s:o,f:t[o]});var a=i.length,s=i.slice();if(!a)return[q,0];if(1==a){var f=new n(i[0].s+1);return f[i[0].s]=1,[f,1]}i.sort((function(t,n){return t.f-n.f})),i.push({s:-1,f:25001});var u=i[0],h=i[1],c=0,l=1,p=2;for(i[0]={s:-1,f:u.f+h.f,l:u,r:h};l!=a-1;)u=i[i[c].f<i[p].f?c++:p++],h=i[c!=l&&i[c].f<i[p].f?c++:p++],i[l++]={s:-1,f:u.f+h.f,l:u,r:h};var v=s[0].s;for(o=1;o<a;++o)s[o].s>v&&(v=s[o].s);var d=new r(v+1),g=I(i[l-1],d,0);if(g>e){o=0;var w=0,y=g-e,m=1<<y;for(s.sort((function(t,n){return d[n.s]-d[t.s]||t.f-n.f}));o<a;++o){var b=s[o].s;if(!(d[b]>e))break;w+=m-(1<<g-d[b]),d[b]=e}for(w>>>=y;w>0;){var x=s[o].s;d[x]<e?w-=1<<e-d[x]++-1:++o}for(;o>=0&&w;--o){var z=s[o].s;d[z]==e&&(--d[z],++w)}g=e}return[new n(d),g]},I=function(t,n,r){return-1==t.s?Math.max(I(t.l,n,r+1),I(t.r,n,r+1)):n[t.s]=r},F=function(t){for(var n=t.length;n&&!t[--n];);for(var e=new r(++n),i=0,o=t[0],a=1,s=function(t){e[i++]=t},f=1;f<=n;++f)if(t[f]==o&&f!=n)++a;else{if(!o&&a>2){for(;a>138;a-=138)s(32754);a>2&&(s(a>10?a-11<<5|28690:a-3<<5|12305),a=0)}else if(a>3){for(s(o),--a;a>6;a-=6)s(8304);a>2&&(s(a-3<<5|8208),a=0)}for(;a--;)s(o);a=1,o=t[f]}return[e.subarray(0,i),n]},E=function(t,n){for(var r=0,e=0;e<n.length;++e)r+=t[e]*n[e];return r},G=function(t,n,r){var e=r.length,i=D(n+2);t[i]=255&e,t[i+1]=e>>>8,t[i+2]=255^t[i],t[i+3]=255^t[i+1];for(var o=0;o<e;++o)t[i+o+4]=r[o];return 8*(i+4+e)},P=function(t,n,e,s,f,u,h,c,l,p,v){O(n,v++,e),++f[256];for(var d=Z(f,15),g=d[0],x=d[1],k=Z(u,15),M=k[0],A=k[1],S=F(g),D=S[0],C=S[1],U=F(M),I=U[0],P=U[1],j=new r(19),q=0;q<D.length;++q)j[31&D[q]]++;for(q=0;q<I.length;++q)j[31&I[q]]++;for(var H=Z(j,7),Y=H[0],B=H[1],J=19;J>4&&!Y[a[J-1]];--J);var K,L,N,Q,R=p+5<<3,V=E(f,y)+E(u,m)+h,W=E(f,g)+E(u,M)+h+14+3*J+E(j,Y)+(2*j[16]+3*j[17]+7*j[18]);if(R<=V&&R<=W)return G(n,v,t.subarray(l,l+p));if(O(n,v,1+(W<V)),v+=2,W<V){K=w(g,x,0),L=g,N=w(M,A,0),Q=M;var X=w(Y,B,0);for(O(n,v,C-257),O(n,v+5,P-1),O(n,v+10,J-4),v+=14,q=0;q<J;++q)O(n,v+3*q,Y[a[q]]);v+=3*J;for(var $=[D,I],_=0;_<2;++_){var tt=$[_];for(q=0;q<tt.length;++q)O(n,v,X[nt=31&tt[q]]),v+=Y[nt],nt>15&&(O(n,v,tt[q]>>>5&127),v+=tt[q]>>>12)}}else K=b,L=y,N=z,Q=m;for(q=0;q<c;++q)if(s[q]>255){var nt;T(n,v,K[257+(nt=s[q]>>>18&31)]),v+=L[nt+257],nt>7&&(O(n,v,s[q]>>>23&31),v+=i[nt]);var rt=31&s[q];T(n,v,N[rt]),v+=Q[rt],rt>3&&(T(n,v,s[q]>>>5&8191),v+=o[rt])}else T(n,v,K[s[q]]),v+=L[s[q]];return T(n,v,K[256]),v+L[256]},j=new e([65540,131080,131088,131104,262176,1048704,1048832,2114560,2117632]),q=new n(0),H=function(t,a,s,f,u,c){var l=t.length,v=new n(f+l+5*(1+Math.ceil(l/7e3))+u),d=v.subarray(f,v.length-u),g=0;if(!a||l<8)for(var w=0;w<=l;w+=65535){var y=w+65535;y<l?g=G(d,g,t.subarray(w,y)):(d[w]=c,g=G(d,g,t.subarray(w,l)))}else{for(var m=j[a-1],b=m>>>13,x=8191&m,z=(1<<s)-1,k=new r(32768),M=new r(z+1),A=Math.ceil(s/3),S=2*A,U=function(n){return(t[n]^t[n+1]<<A^t[n+2]<<S)&z},O=new e(25e3),T=new r(288),Z=new r(32),I=0,F=0,E=(w=0,0),H=0,Y=0;w<l;++w){var B=U(w),J=32767&w,K=M[B];if(k[J]=K,M[B]=J,H<=w){var L=l-w;if((I>7e3||E>24576)&&L>423){g=P(t,d,0,O,T,Z,F,E,Y,w-Y,g),E=I=F=0,Y=w;for(var N=0;N<286;++N)T[N]=0;for(N=0;N<30;++N)Z[N]=0}var Q=2,R=0,V=x,W=J-K&32767;if(L>2&&B==U(w-W))for(var X=Math.min(b,L)-1,$=Math.min(32767,w),_=Math.min(258,L);W<=$&&--V&&J!=K;){if(t[w+Q]==t[w+Q-W]){for(var tt=0;tt<_&&t[w+tt]==t[w+tt-W];++tt);if(tt>Q){if(Q=tt,R=W,tt>X)break;var nt=Math.min(W,tt-2),rt=0;for(N=0;N<nt;++N){var et=w-W+N+32768&32767,it=et-k[et]+32768&32767;it>rt&&(rt=it,K=et)}}}W+=(J=K)-(K=k[J])+32768&32767}if(R){O[E++]=268435456|h[Q]<<18|p[R];var ot=31&h[Q],at=31&p[R];F+=i[ot]+o[at],++T[257+ot],++Z[at],H=w+Q,++I}else O[E++]=t[w],++T[t[w]]}}g=P(t,d,c,O,T,Z,F,E,Y,w-Y,g),!c&&7&g&&(g=G(d,g+1,q))}return C(v,0,f+D(g)+u)},Y=function(){for(var t=new e(256),n=0;n<256;++n){for(var r=n,i=9;--i;)r=(1&r&&3988292384)^r>>>1;t[n]=r}return t}(),B=function(){var t=-1;return{p:function(n){for(var r=t,e=0;e<n.length;++e)r=Y[255&r^n[e]]^r>>>8;t=r},d:function(){return~t}}},J=function(){var t=1,n=0;return{p:function(r){for(var e=t,i=n,o=r.length,a=0;a!=o;){for(var s=Math.min(a+2655,o);a<s;++a)i+=e+=r[a];e=(65535&e)+15*(e>>16),i=(65535&i)+15*(i>>16)}t=e,n=i},d:function(){return(255&(t%=65521))<<24|t>>>8<<16|(255&(n%=65521))<<8|n>>>8}}},K=function(t,n,r,e,i){return H(t,null==n.level?6:n.level,null==n.mem?Math.ceil(1.5*Math.max(8,Math.min(13,Math.log(t.length)))):12+n.mem,r,e,!i)},L=function(t,n){var r={};for(var e in t)r[e]=t[e];for(var e in n)r[e]=n[e];return r},N=function(t,n,r){for(var e=t(),i=""+t,o=i.slice(i.indexOf("[")+1,i.lastIndexOf("]")).replace(/ /g,"").split(","),a=0;a<e.length;++a){var s=e[a],f=o[a];if("function"==typeof s){n+=";"+f+"=";var u=""+s;if(s.prototype)if(-1!=u.indexOf("[native code]")){var h=u.indexOf(" ",8)+1;n+=u.slice(h,u.indexOf("(",h))}else for(var c in n+=u,s.prototype)n+=";"+f+".prototype."+c+"="+s.prototype[c];else n+=u}else r[f]=s}return[n,r]},Q=[],R=function(t){var i=[];for(var o in t)(t[o]instanceof n||t[o]instanceof r||t[o]instanceof e)&&i.push((t[o]=new t[o].constructor(t[o])).buffer);return i},V=function(n,r,e,i){var o;if(!Q[e]){for(var a="",s={},f=n.length-1,u=0;u<f;++u)a=(o=N(n[u],a,s))[0],s=o[1];Q[e]=N(n[f],a,s)}var h=L({},Q[e][1]);return t.default(Q[e][0]+";onmessage=function(e){for(var k in e.data)self[k]=e.data[k];onmessage="+r+"}",e,h,R(h),i)},W=function(){return[n,r,e,i,o,a,u,l,x,k,v,w,M,A,S,D,C,U,At,rt,et]},X=function(){return[n,r,e,i,o,a,h,p,b,y,z,m,v,j,q,w,O,T,Z,I,F,E,G,P,D,C,H,K,xt,rt]},$=function(){return[ct,vt,ht,B,Y]},_=function(){return[lt,pt]},tt=function(){return[dt,ht,J]},nt=function(){return[gt]},rt=function(t){return postMessage(t,[t.buffer])},et=function(t){return t&&t.size&&new n(t.size)},it=function(t,n,r,e,i,o){var a=V(r,e,i,(function(t,n){a.terminate(),o(t,n)}));return a.postMessage([t,n],n.consume?[t.buffer]:[]),function(){a.terminate()}},ot=function(t){return t.ondata=function(t,n){return postMessage([t,n],[t.buffer])},function(n){return t.push(n.data[0],n.data[1])}},at=function(t,n,r,e,i){var o,a=V(t,e,i,(function(t,r){t?(a.terminate(),n.ondata.call(n,t)):(r[1]&&a.terminate(),n.ondata.call(n,t,r[0],r[1]))}));a.postMessage(r),n.push=function(t,r){if(o)throw"stream finished";if(!n.ondata)throw"no stream handler";a.postMessage([t,o=r],[t.buffer])},n.terminate=function(){a.terminate()}},st=function(t,n){return t[n]|t[n+1]<<8},ft=function(t,n){return(t[n]|t[n+1]<<8|t[n+2]<<16|t[n+3]<<24)>>>0},ut=function(t,n){return ft(t,n)+4294967296*ft(t,n+4)},ht=function(t,n,r){for(;r;++n)t[n]=r,r>>>=8},ct=function(t,n){var r=n.filename;if(t[0]=31,t[1]=139,t[2]=8,t[8]=n.level<2?4:9==n.level?2:0,t[9]=3,0!=n.mtime&&ht(t,4,Math.floor(new Date(n.mtime||Date.now())/1e3)),r){t[3]=8;for(var e=0;e<=r.length;++e)t[e+10]=r.charCodeAt(e)}},lt=function(t){if(31!=t[0]||139!=t[1]||8!=t[2])throw"invalid gzip data";var n=t[3],r=10;4&n&&(r+=t[10]|2+(t[11]<<8));for(var e=(n>>3&1)+(n>>4&1);e>0;e-=!t[r++]);return r+(2&n)},pt=function(t){var n=t.length;return(t[n-4]|t[n-3]<<8|t[n-2]<<16|t[n-1]<<24)>>>0},vt=function(t){return 10+(t.filename&&t.filename.length+1||0)},dt=function(t,n){var r=n.level,e=0==r?0:r<6?1:9==r?3:2;t[0]=120,t[1]=e<<6|(e?32-2*e:1)},gt=function(t){if(8!=(15&t[0])||t[0]>>>4>7||(t[0]<<8|t[1])%31)throw"invalid zlib data";if(32&t[1])throw"invalid zlib data: preset dictionaries not supported"};function wt(t,n){return n||"function"!=typeof t||(n=t,t={}),this.ondata=n,t}var yt=function(){function t(t,n){n||"function"!=typeof t||(n=t,t={}),this.ondata=n,this.o=t||{}}return t.prototype.p=function(t,n){this.ondata(K(t,this.o,0,0,!n),n)},t.prototype.push=function(t,n){if(this.d)throw"stream finished";if(!this.ondata)throw"no stream handler";this.d=n,this.p(t,n||!1)},t}();_e.Deflate=yt;var mt=function(){return function(t,n){at([X,function(){return[ot,yt]}],this,wt.call(this,t,n),(function(t){var n=new yt(t.data);onmessage=ot(n)}),6)}}();function bt(t,n,r){if(r||(r=n,n={}),"function"!=typeof r)throw"no callback";return it(t,n,[X],(function(t){return rt(xt(t.data[0],t.data[1]))}),0,r)}function xt(t,n){return K(t,n||{},0,0)}_e.AsyncDeflate=mt,_e.deflate=bt,_e.deflateSync=xt;var zt=function(){function t(t){this.s={},this.p=new n(0),this.ondata=t}return t.prototype.e=function(t){if(this.d)throw"stream finished";if(!this.ondata)throw"no stream handler";var r=this.p.length,e=new n(r+t.length);e.set(this.p),e.set(t,r),this.p=e},t.prototype.c=function(t){this.d=this.s.i=t||!1;var n=this.s.b,r=U(this.p,this.o,this.s);this.ondata(C(r,n,this.s.b),this.d),this.o=C(r,this.s.b-32768),this.s.b=this.o.length,this.p=C(this.p,this.s.p/8|0),this.s.p&=7},t.prototype.push=function(t,n){this.e(t),this.c(n)},t}();_e.Inflate=zt;var kt=function(){return function(t){this.ondata=t,at([W,function(){return[ot,zt]}],this,0,(function(){var t=new zt;onmessage=ot(t)}),7)}}();function Mt(t,n,r){if(r||(r=n,n={}),"function"!=typeof r)throw"no callback";return it(t,n,[W],(function(t){return rt(At(t.data[0],et(t.data[1])))}),1,r)}function At(t,n){return U(t,n)}_e.AsyncInflate=kt,_e.inflate=Mt,_e.inflateSync=At;var St=function(){function t(t,n){this.c=B(),this.l=0,this.v=1,yt.call(this,t,n)}return t.prototype.push=function(t,n){yt.prototype.push.call(this,t,n)},t.prototype.p=function(t,n){this.c.p(t),this.l+=t.length;var r=K(t,this.o,this.v&&vt(this.o),n&&8,!n);this.v&&(ct(r,this.o),this.v=0),n&&(ht(r,r.length-8,this.c.d()),ht(r,r.length-4,this.l)),this.ondata(r,n)},t}();_e.Gzip=St,_e.Compress=St;var Dt=function(){return function(t,n){at([X,$,function(){return[ot,yt,St]}],this,wt.call(this,t,n),(function(t){var n=new St(t.data);onmessage=ot(n)}),8)}}();function Ct(t,n,r){if(r||(r=n,n={}),"function"!=typeof r)throw"no callback";return it(t,n,[X,$,function(){return[Ut]}],(function(t){return rt(Ut(t.data[0],t.data[1]))}),2,r)}function Ut(t,n){n||(n={});var r=B(),e=t.length;r.p(t);var i=K(t,n,vt(n),8),o=i.length;return ct(i,n),ht(i,o-8,r.d()),ht(i,o-4,e),i}_e.AsyncGzip=Dt,_e.AsyncCompress=Dt,_e.gzip=Ct,_e.compress=Ct,_e.gzipSync=Ut,_e.compressSync=Ut;var Ot=function(){function t(t){this.v=1,zt.call(this,t)}return t.prototype.push=function(t,n){if(zt.prototype.e.call(this,t),this.v){var r=this.p.length>3?lt(this.p):4;if(r>=this.p.length&&!n)return;this.p=this.p.subarray(r),this.v=0}if(n){if(this.p.length<8)throw"invalid gzip stream";this.p=this.p.subarray(0,-8)}zt.prototype.c.call(this,n)},t}();_e.Gunzip=Ot;var Tt=function(){return function(t){this.ondata=t,at([W,_,function(){return[ot,zt,Ot]}],this,0,(function(){var t=new Ot;onmessage=ot(t)}),9)}}();function Zt(t,n,r){if(r||(r=n,n={}),"function"!=typeof r)throw"no callback";return it(t,n,[W,_,function(){return[It]}],(function(t){return rt(It(t.data[0]))}),3,r)}function It(t,r){return U(t.subarray(lt(t),-8),r||new n(pt(t)))}_e.AsyncGunzip=Tt,_e.gunzip=Zt,_e.gunzipSync=It;var Ft=function(){function t(t,n){this.c=J(),this.v=1,yt.call(this,t,n)}return t.prototype.push=function(t,n){yt.prototype.push.call(this,t,n)},t.prototype.p=function(t,n){this.c.p(t);var r=K(t,this.o,this.v&&2,n&&4,!n);this.v&&(dt(r,this.o),this.v=0),n&&ht(r,r.length-4,this.c.d()),this.ondata(r,n)},t}();_e.Zlib=Ft;var Et=function(){return function(t,n){at([X,tt,function(){return[ot,yt,Ft]}],this,wt.call(this,t,n),(function(t){var n=new Ft(t.data);onmessage=ot(n)}),10)}}();function Gt(t,n,r){if(r||(r=n,n={}),"function"!=typeof r)throw"no callback";return it(t,n,[X,tt,function(){return[Pt]}],(function(t){return rt(Pt(t.data[0],t.data[1]))}),4,r)}function Pt(t,n){n||(n={});var r=J();r.p(t);var e=K(t,n,2,4);return dt(e,n),ht(e,e.length-4,r.d()),e}_e.AsyncZlib=Et,_e.zlib=Gt,_e.zlibSync=Pt;var jt=function(){function t(t){this.v=1,zt.call(this,t)}return t.prototype.push=function(t,n){if(zt.prototype.e.call(this,t),this.v){if(this.p.length<2&&!n)return;this.p=this.p.subarray(2),this.v=0}if(n){if(this.p.length<4)throw"invalid zlib stream";this.p=this.p.subarray(0,-4)}zt.prototype.c.call(this,n)},t}();_e.Unzlib=jt;var qt=function(){return function(t){this.ondata=t,at([W,nt,function(){return[ot,zt,jt]}],this,0,(function(){var t=new jt;onmessage=ot(t)}),11)}}();function Ht(t,n,r){if(r||(r=n,n={}),"function"!=typeof r)throw"no callback";return it(t,n,[W,nt,function(){return[Yt]}],(function(t){return rt(Yt(t.data[0],et(t.data[1])))}),5,r)}function Yt(t,n){return U((gt(t),t.subarray(2,-4)),n)}_e.AsyncUnzlib=qt,_e.unzlib=Ht,_e.unzlibSync=Yt;var Bt=function(){function t(t){this.G=Ot,this.I=zt,this.Z=jt,this.ondata=t}return t.prototype.push=function(t,r){if(!this.ondata)throw"no stream handler";if(this.s)this.s.push(t,r);else{if(this.p&&this.p.length){var e=new n(this.p.length+t.length);e.set(this.p),e.set(t,this.p.length)}else this.p=t;if(this.p.length>2){var i=this,o=function(){i.ondata.apply(i,arguments)};this.s=31==this.p[0]&&139==this.p[1]&&8==this.p[2]?new this.G(o):8!=(15&this.p[0])||this.p[0]>>4>7||(this.p[0]<<8|this.p[1])%31?new this.I(o):new this.Z(o),this.s.push(this.p,r),this.p=null}}},t}();_e.Decompress=Bt;var Jt=function(){function t(t){this.G=Tt,this.I=kt,this.Z=qt,this.ondata=t}return t.prototype.push=function(t,n){Bt.prototype.push.call(this,t,n)},t}();function Kt(t,n,r){if(r||(r=n,n={}),"function"!=typeof r)throw"no callback";return 31==t[0]&&139==t[1]&&8==t[2]?Zt(t,n,r):8!=(15&t[0])||t[0]>>4>7||(t[0]<<8|t[1])%31?Mt(t,n,r):Ht(t,n,r)}function Lt(t,n){return 31==t[0]&&139==t[1]&&8==t[2]?It(t,n):8!=(15&t[0])||t[0]>>4>7||(t[0]<<8|t[1])%31?At(t,n):Yt(t,n)}_e.AsyncDecompress=Jt,_e.decompress=Kt,_e.decompressSync=Lt;var Nt=function(t,r,e,i){for(var o in t){var a=t[o],s=r+o;a instanceof n?e[s]=[a,i]:Array.isArray(a)?e[s]=[a[0],L(i,a[1])]:Nt(a,s+"/",e,i)}},Qt="undefined"!=typeof TextEncoder&&new TextEncoder,Rt="undefined"!=typeof TextDecoder&&new TextDecoder,Vt=0;try{Rt.decode(q,{stream:!0}),Vt=1}catch(t){}var Wt=function(t){for(var n="",r=0;;){var e=t[r++],i=(e>127)+(e>223)+(e>239);if(r+i>t.length)return[n,C(t,r-1)];i?3==i?(e=((15&e)<<18|(63&t[r++])<<12|(63&t[r++])<<6|63&t[r++])-65536,n+=String.fromCharCode(55296|e>>10,56320|1023&e)):n+=String.fromCharCode(1&i?(31&e)<<6|63&t[r++]:(15&e)<<12|(63&t[r++])<<6|63&t[r++]):n+=String.fromCharCode(e)}},Xt=function(){function t(t){this.ondata=t,Vt?this.t=new TextDecoder:this.p=q}return t.prototype.push=function(t,r){if(!this.ondata)throw"no callback";if(r=!!r,this.t){if(this.ondata(this.t.decode(t,{stream:!0}),r),r){if(this.t.decode().length)throw"invalid utf-8 data";this.t=null}}else{if(!this.p)throw"stream finished";var e=new n(this.p.length+t.length);e.set(this.p),e.set(t,this.p.length);var i=Wt(e),o=i[0],a=i[1];if(r){if(a.length)throw"invalid utf-8 data";this.p=null}else this.p=a;this.ondata(o,r)}},t}();_e.DecodeUTF8=Xt;var $t=function(){function t(t){this.ondata=t}return t.prototype.push=function(t,n){if(!this.ondata)throw"no callback";if(this.d)throw"stream finished";this.ondata(_t(t),this.d=n||!1)},t}();function _t(t,r){if(r){for(var e=new n(t.length),i=0;i<t.length;++i)e[i]=t.charCodeAt(i);return e}if(Qt)return Qt.encode(t);var o=t.length,a=new n(t.length+(t.length>>1)),s=0,f=function(t){a[s++]=t};for(i=0;i<o;++i){if(s+5>a.length){var u=new n(s+8+(o-i<<1));u.set(a),a=u}var h=t.charCodeAt(i);h<128||r?f(h):h<2048?(f(192|h>>6),f(128|63&h)):h>55295&&h<57344?(f(240|(h=65536+(1047552&h)|1023&t.charCodeAt(++i))>>18),f(128|h>>12&63),f(128|h>>6&63),f(128|63&h)):(f(224|h>>12),f(128|h>>6&63),f(128|63&h))}return C(a,0,s)}function tn(t,n){if(n){for(var r="",e=0;e<t.length;e+=16384)r+=String.fromCharCode.apply(null,t.subarray(e,e+16384));return r}if(Rt)return Rt.decode(t);var i=Wt(t);if(i[1].length)throw"invalid utf-8 data";return i[0]}_e.EncodeUTF8=$t,_e.strToU8=_t,_e.strFromU8=tn;var nn=function(t){return 1==t?3:t<6?2:9==t?1:0},rn=function(t,n){return n+30+st(t,n+26)+st(t,n+28)},en=function(t,n,r){var e=st(t,n+28),i=tn(t.subarray(n+46,n+46+e),!(2048&st(t,n+8))),o=n+46+e,a=ft(t,n+20),s=r&&4294967295==a?on(t,o):[a,ft(t,n+24),ft(t,n+42)],f=s[0],u=s[1],h=s[2];return[st(t,n+10),f,u,i,o+st(t,n+30)+st(t,n+32),h]},on=function(t,n){for(;1!=st(t,n);n+=4+st(t,n+2));return[ut(t,n+12),ut(t,n+4),ut(t,n+20)]},an=function(t){var n=0;if(t)for(var r in t){var e=t[r].length;if(e>65535)throw"extra field too long";n+=e+4}return n},sn=function(t,n,r,e,i,o,a,s){var f=e.length,u=r.extra,h=s&&s.length,c=an(u);ht(t,n,null!=a?33639248:67324752),n+=4,null!=a&&(t[n++]=20,t[n++]=r.os),t[n]=20,n+=2,t[n++]=r.flag<<1|(null==o&&8),t[n++]=i&&8,t[n++]=255&r.compression,t[n++]=r.compression>>8;var l=new Date(null==r.mtime?Date.now():r.mtime),p=l.getFullYear()-1980;if(p<0||p>119)throw"date not in range 1980-2099";if(ht(t,n,p<<25|l.getMonth()+1<<21|l.getDate()<<16|l.getHours()<<11|l.getMinutes()<<5|l.getSeconds()>>>1),n+=4,null!=o&&(ht(t,n,r.crc),ht(t,n+4,o),ht(t,n+8,r.size)),ht(t,n+12,f),ht(t,n+14,c),n+=16,null!=a&&(ht(t,n,h),ht(t,n+6,r.attrs),ht(t,n+10,a),n+=14),t.set(e,n),n+=f,c)for(var v in u){var d=u[v],g=d.length;ht(t,n,+v),ht(t,n+2,g),t.set(d,n+4),n+=4+g}return h&&(t.set(s,n),n+=h),n},fn=function(t,n,r,e,i){ht(t,n,101010256),ht(t,n+8,r),ht(t,n+10,r),ht(t,n+12,e),ht(t,n+16,i)},un=function(){function t(t){this.filename=t,this.c=B(),this.size=0,this.compression=0}return t.prototype.process=function(t,n){this.ondata(null,t,n)},t.prototype.push=function(t,n){if(!this.ondata)throw"no callback - add to ZIP archive before pushing";this.c.p(t),this.size+=t.length,n&&(this.crc=this.c.d()),this.process(t,n||!1)},t}();_e.ZipPassThrough=un;var hn=function(){function t(t,n){var r=this;n||(n={}),un.call(this,t),this.d=new yt(n,(function(t,n){r.ondata(null,t,n)})),this.compression=8,this.flag=nn(n.level)}return t.prototype.process=function(t,n){try{this.d.push(t,n)}catch(t){this.ondata(t,null,n)}},t.prototype.push=function(t,n){un.prototype.push.call(this,t,n)},t}();_e.ZipDeflate=hn;var cn=function(){function t(t,n){var r=this;n||(n={}),un.call(this,t),this.d=new mt(n,(function(t,n,e){r.ondata(t,n,e)})),this.compression=8,this.flag=nn(n.level),this.terminate=this.d.terminate}return t.prototype.process=function(t,n){this.d.push(t,n)},t.prototype.push=function(t,n){un.prototype.push.call(this,t,n)},t}();_e.AsyncZipDeflate=cn;var ln=function(){function t(t){this.ondata=t,this.u=[],this.d=1}return t.prototype.add=function(t){var r=this;if(2&this.d)throw"stream finished";var e=_t(t.filename),i=e.length,o=t.comment,a=o&&_t(o),s=i!=t.filename.length||a&&o.length!=a.length,f=i+an(t.extra)+30;if(i>65535)throw"filename too long";var u=new n(f);sn(u,0,t,e,s);var h=[u],c=function(){for(var t=0,n=h;t<n.length;t++)r.ondata(null,n[t],!1);h=[]},l=this.d;this.d=0;var p=this.u.length,v=L(t,{f:e,u:s,o:a,t:function(){t.terminate&&t.terminate()},r:function(){if(c(),l){var t=r.u[p+1];t?t.r():r.d=1}l=1}}),d=0;t.ondata=function(e,i,o){if(e)r.ondata(e,i,o),r.terminate();else if(d+=i.length,h.push(i),o){var a=new n(16);ht(a,0,134695760),ht(a,4,t.crc),ht(a,8,d),ht(a,12,t.size),h.push(a),v.c=d,v.b=f+d+16,v.crc=t.crc,v.size=t.size,l&&v.r(),l=1}else l&&c()},this.u.push(v)},t.prototype.end=function(){var t=this;if(2&this.d){if(1&this.d)throw"stream finishing";throw"stream finished"}this.d?this.e():this.u.push({r:function(){1&t.d&&(t.u.splice(-1,1),t.e())},t:function(){}}),this.d=3},t.prototype.e=function(){for(var t=0,r=0,e=0,i=0,o=this.u;i<o.length;i++)e+=46+(u=o[i]).f.length+an(u.extra)+(u.o?u.o.length:0);for(var a=new n(e+22),s=0,f=this.u;s<f.length;s++){var u;sn(a,t,u=f[s],u.f,u.u,u.c,r,u.o),t+=46+u.f.length+an(u.extra)+(u.o?u.o.length:0),r+=u.b}fn(a,t,this.u.length,e,r),this.ondata(null,a,!0),this.d=2},t.prototype.terminate=function(){for(var t=0,n=this.u;t<n.length;t++)n[t].t();this.d=2},t}();function pn(t,r,e){if(e||(e=r,r={}),"function"!=typeof e)throw"no callback";var i={};Nt(t,"",i,r);var o=Object.keys(i),a=o.length,s=0,f=0,u=a,h=Array(a),c=[],l=function(){for(var t=0;t<c.length;++t)c[t]()},p=function(){var t=new n(f+22),r=s,i=f-s;f=0;for(var o=0;o<u;++o){var a=h[o];try{var c=a.c.length;sn(t,f,a,a.f,a.u,c);var l=30+a.f.length+an(a.extra),p=f+l;t.set(a.c,p),sn(t,s,a,a.f,a.u,c,f,a.m),s+=16+l+(a.m?a.m.length:0),f=p+c}catch(t){return e(t,null)}}fn(t,s,h.length,i,r),e(null,t)};a||p();for(var v=function(t){var n=o[t],r=i[n],u=r[0],v=r[1],d=B(),g=u.length;d.p(u);var w=_t(n),y=w.length,m=v.comment,b=m&&_t(m),x=b&&b.length,z=an(v.extra),k=0==v.level?0:8,M=function(r,i){if(r)l(),e(r,null);else{var o=i.length;h[t]=L(v,{size:g,crc:d.d(),c:i,f:w,m:b,u:y!=n.length||b&&m.length!=x,compression:k}),s+=30+y+z+o,f+=76+2*(y+z)+(x||0)+o,--a||p()}};if(y>65535&&M("filename too long",null),k)if(g<16e4)try{M(null,xt(u,v))}catch(t){M(t,null)}else c.push(bt(u,v,M));else M(null,u)},d=0;d<u;++d)v(d);return l}function vn(t,r){r||(r={});var e={},i=[];Nt(t,"",e,r);var o=0,a=0;for(var s in e){var f=e[s],u=f[0],h=f[1],c=0==h.level?0:8,l=(M=_t(s)).length,p=h.comment,v=p&&_t(p),d=v&&v.length,g=an(h.extra);if(l>65535)throw"filename too long";var w=c?xt(u,h):u,y=w.length,m=B();m.p(u),i.push(L(h,{size:u.length,crc:m.d(),c:w,f:M,m:v,u:l!=s.length||v&&p.length!=d,o:o,compression:c})),o+=30+l+g+y,a+=76+2*(l+g)+(d||0)+y}for(var b=new n(a+22),x=o,z=a-o,k=0;k<i.length;++k){var M;sn(b,(M=i[k]).o,M,M.f,M.u,M.c.length);var A=30+M.f.length+an(M.extra);b.set(M.c,M.o+A),sn(b,o,M,M.f,M.u,M.c.length,M.o,M.m),o+=16+A+(M.m?M.m.length:0)}return fn(b,o,i.length,z,x),b}_e.Zip=ln,_e.zip=pn,_e.zipSync=vn;var dn=function(){function t(){}return t.prototype.push=function(t,n){this.ondata(null,t,n)},t.compression=0,t}();_e.UnzipPassThrough=dn;var gn=function(){function t(){var t=this;this.i=new zt((function(n,r){t.ondata(null,n,r)}))}return t.prototype.push=function(t,n){try{this.i.push(t,n)}catch(r){this.ondata(r,t,n)}},t.compression=8,t}();_e.UnzipInflate=gn;var wn=function(){function t(t,n){var r=this;n<32e4?this.i=new zt((function(t,n){r.ondata(null,t,n)})):(this.i=new kt((function(t,n,e){r.ondata(t,n,e)})),this.terminate=this.i.terminate)}return t.prototype.push=function(t,n){this.i.terminate&&(t=C(t,0)),this.i.push(t,n)},t.compression=8,t}();_e.AsyncUnzipInflate=wn;var yn=function(){function t(t){this.onfile=t,this.k=[],this.o={0:dn},this.p=q}return t.prototype.push=function(t,r){var e=this;if(!this.onfile)throw"no callback";if(!this.p)throw"stream finished";if(this.c>0){var i=Math.min(this.c,t.length),o=t.subarray(0,i);if(this.c-=i,this.d?this.d.push(o,!this.c):this.k[0].push(o),(t=t.subarray(i)).length)return this.push(t,r)}else{var a=0,s=0,f=void 0,u=void 0;this.p.length?t.length?((u=new n(this.p.length+t.length)).set(this.p),u.set(t,this.p.length)):u=this.p:u=t;for(var h=u.length,c=this.c,l=c&&this.d,p=function(){var t,n=ft(u,s);if(67324752==n){a=1,f=s,v.d=null,v.c=0;var r=st(u,s+6),i=st(u,s+8),o=2048&r,l=8&r,p=st(u,s+26),d=st(u,s+28);if(h>s+30+p+d){var g=[];v.k.unshift(g),a=2;var w,y=ft(u,s+18),m=ft(u,s+22),b=tn(u.subarray(s+30,s+=30+p),!o);4294967295==y?(t=l?[-2]:on(u,s),y=t[0],m=t[1]):l&&(y=-1),s+=d,v.c=y;var x={name:b,compression:i,start:function(){if(!x.ondata)throw"no callback";if(y){var t=e.o[i];if(!t)throw"unknown compression type "+i;(w=y<0?new t(b):new t(b,y,m)).ondata=function(t,n,r){x.ondata(t,n,r)};for(var n=0,r=g;n<r.length;n++)w.push(r[n],!1);e.k[0]==g&&e.c?e.d=w:w.push(q,!0)}else x.ondata(null,q,!0)},terminate:function(){w&&w.terminate&&w.terminate()}};y>=0&&(x.size=y,x.originalSize=m),v.onfile(x)}return"break"}if(c){if(134695760==n)return f=s+=12+(-2==c&&8),a=3,v.c=0,"break";if(33639248==n)return f=s-=4,a=3,v.c=0,"break"}},v=this;s<h-4&&"break"!==p();++s);if(this.p=q,c<0){var d=u.subarray(0,a?f-12-(-2==c&&8)-(134695760==ft(u,f-16)&&4):s);l?l.push(d,!!a):this.k[+(2==a)].push(d)}if(2&a)return this.push(u.subarray(s),r);this.p=u.subarray(s)}if(r){if(this.c)throw"invalid zip file";this.p=null}},t.prototype.register=function(t){this.o[t.compression]=t},t}();function mn(t,r){if("function"!=typeof r)throw"no callback";for(var e=[],i=function(){for(var t=0;t<e.length;++t)e[t]()},o={},a=t.length-22;101010256!=ft(t,a);--a)if(!a||t.length-a>65558)return void r("invalid zip file",null);var s=st(t,a+8);s||r(null,{});var f=s,u=ft(t,a+16),h=4294967295==u;if(h){if(a=ft(t,a-12),101075792!=ft(t,a))return void r("invalid zip file",null);f=s=ft(t,a+32),u=ft(t,a+48)}for(var c=function(a){var f=en(t,u,h),c=f[0],l=f[1],p=f[2],v=f[3],d=f[4],g=rn(t,f[5]);u=d;var w=function(t,n){t?(i(),r(t,null)):(o[v]=n,--s||r(null,o))};if(c)if(8==c){var y=t.subarray(g,g+l);if(l<32e4)try{w(null,At(y,new n(p)))}catch(t){w(t,null)}else e.push(Mt(y,{size:p},w))}else w("unknown compression type "+c,null);else w(null,C(t,g,g+l))},l=0;l<f;++l)c();return i}function bn(t){for(var r={},e=t.length-22;101010256!=ft(t,e);--e)if(!e||t.length-e>65558)throw"invalid zip file";var i=st(t,e+8);if(!i)return{};var o=ft(t,e+16),a=4294967295==o;if(a){if(e=ft(t,e-12),101075792!=ft(t,e))throw"invalid zip file";i=ft(t,e+32),o=ft(t,e+48)}for(var s=0;s<i;++s){var f=en(t,o,a),u=f[0],h=f[1],c=f[2],l=f[3],p=f[4],v=rn(t,f[5]);if(o=p,u){if(8!=u)throw"unknown compression type "+u;r[l]=At(t.subarray(v,v+h),new n(c))}else r[l]=C(t,v,v+h)}return r}_e.Unzip=yn,_e.unzip=mn,_e.unzipSync=bn;return _e})
;( function () {

	/**
 * NURBS utils
 *
 * See NURBSCurve and NURBSSurface.
 **/

	/**************************************************************
 *	NURBS Utils
 **************************************************************/

	class NURBSUtils {

		/*
  Finds knot vector span.
  	p : degree
  u : parametric value
  U : knot vector
  	returns the span
  */
		static findSpan( p, u, U ) {

			const n = U.length - p - 1;

			if ( u >= U[ n ] ) {

				return n - 1;

			}

			if ( u <= U[ p ] ) {

				return p;

			}

			let low = p;
			let high = n;
			let mid = Math.floor( ( low + high ) / 2 );

			while ( u < U[ mid ] || u >= U[ mid + 1 ] ) {

				if ( u < U[ mid ] ) {

					high = mid;

				} else {

					low = mid;

				}

				mid = Math.floor( ( low + high ) / 2 );

			}

			return mid;

		}
		/*
  Calculate basis functions. See The NURBS Book, page 70, algorithm A2.2
  	span : span in which u lies
  u    : parametric point
  p    : degree
  U    : knot vector
  	returns array[p+1] with basis functions values.
  */


		static calcBasisFunctions( span, u, p, U ) {

			const N = [];
			const left = [];
			const right = [];
			N[ 0 ] = 1.0;

			for ( let j = 1; j <= p; ++ j ) {

				left[ j ] = u - U[ span + 1 - j ];
				right[ j ] = U[ span + j ] - u;
				let saved = 0.0;

				for ( let r = 0; r < j; ++ r ) {

					const rv = right[ r + 1 ];
					const lv = left[ j - r ];
					const temp = N[ r ] / ( rv + lv );
					N[ r ] = saved + rv * temp;
					saved = lv * temp;

				}

				N[ j ] = saved;

			}

			return N;

		}
		/*
  Calculate B-Spline curve points. See The NURBS Book, page 82, algorithm A3.1.
  	p : degree of B-Spline
  U : knot vector
  P : control points (x, y, z, w)
  u : parametric point
  	returns point for given u
  */


		static calcBSplinePoint( p, U, P, u ) {

			const span = this.findSpan( p, u, U );
			const N = this.calcBasisFunctions( span, u, p, U );
			const C = new THREE.Vector4( 0, 0, 0, 0 );

			for ( let j = 0; j <= p; ++ j ) {

				const point = P[ span - p + j ];
				const Nj = N[ j ];
				const wNj = point.w * Nj;
				C.x += point.x * wNj;
				C.y += point.y * wNj;
				C.z += point.z * wNj;
				C.w += point.w * Nj;

			}

			return C;

		}
		/*
  Calculate basis functions derivatives. See The NURBS Book, page 72, algorithm A2.3.
  	span : span in which u lies
  u    : parametric point
  p    : degree
  n    : number of derivatives to calculate
  U    : knot vector
  	returns array[n+1][p+1] with basis functions derivatives
  */


		static calcBasisFunctionDerivatives( span, u, p, n, U ) {

			const zeroArr = [];

			for ( let i = 0; i <= p; ++ i ) zeroArr[ i ] = 0.0;

			const ders = [];

			for ( let i = 0; i <= n; ++ i ) ders[ i ] = zeroArr.slice( 0 );

			const ndu = [];

			for ( let i = 0; i <= p; ++ i ) ndu[ i ] = zeroArr.slice( 0 );

			ndu[ 0 ][ 0 ] = 1.0;
			const left = zeroArr.slice( 0 );
			const right = zeroArr.slice( 0 );

			for ( let j = 1; j <= p; ++ j ) {

				left[ j ] = u - U[ span + 1 - j ];
				right[ j ] = U[ span + j ] - u;
				let saved = 0.0;

				for ( let r = 0; r < j; ++ r ) {

					const rv = right[ r + 1 ];
					const lv = left[ j - r ];
					ndu[ j ][ r ] = rv + lv;
					const temp = ndu[ r ][ j - 1 ] / ndu[ j ][ r ];
					ndu[ r ][ j ] = saved + rv * temp;
					saved = lv * temp;

				}

				ndu[ j ][ j ] = saved;

			}

			for ( let j = 0; j <= p; ++ j ) {

				ders[ 0 ][ j ] = ndu[ j ][ p ];

			}

			for ( let r = 0; r <= p; ++ r ) {

				let s1 = 0;
				let s2 = 1;
				const a = [];

				for ( let i = 0; i <= p; ++ i ) {

					a[ i ] = zeroArr.slice( 0 );

				}

				a[ 0 ][ 0 ] = 1.0;

				for ( let k = 1; k <= n; ++ k ) {

					let d = 0.0;
					const rk = r - k;
					const pk = p - k;

					if ( r >= k ) {

						a[ s2 ][ 0 ] = a[ s1 ][ 0 ] / ndu[ pk + 1 ][ rk ];
						d = a[ s2 ][ 0 ] * ndu[ rk ][ pk ];

					}

					const j1 = rk >= - 1 ? 1 : - rk;
					const j2 = r - 1 <= pk ? k - 1 : p - r;

					for ( let j = j1; j <= j2; ++ j ) {

						a[ s2 ][ j ] = ( a[ s1 ][ j ] - a[ s1 ][ j - 1 ] ) / ndu[ pk + 1 ][ rk + j ];
						d += a[ s2 ][ j ] * ndu[ rk + j ][ pk ];

					}

					if ( r <= pk ) {

						a[ s2 ][ k ] = - a[ s1 ][ k - 1 ] / ndu[ pk + 1 ][ r ];
						d += a[ s2 ][ k ] * ndu[ r ][ pk ];

					}

					ders[ k ][ r ] = d;
					const j = s1;
					s1 = s2;
					s2 = j;

				}

			}

			let r = p;

			for ( let k = 1; k <= n; ++ k ) {

				for ( let j = 0; j <= p; ++ j ) {

					ders[ k ][ j ] *= r;

				}

				r *= p - k;

			}

			return ders;

		}
		/*
  	Calculate derivatives of a B-Spline. See The NURBS Book, page 93, algorithm A3.2.
  		p  : degree
  	U  : knot vector
  	P  : control points
  	u  : Parametric points
  	nd : number of derivatives
  		returns array[d+1] with derivatives
  	*/


		static calcBSplineDerivatives( p, U, P, u, nd ) {

			const du = nd < p ? nd : p;
			const CK = [];
			const span = this.findSpan( p, u, U );
			const nders = this.calcBasisFunctionDerivatives( span, u, p, du, U );
			const Pw = [];

			for ( let i = 0; i < P.length; ++ i ) {

				const point = P[ i ].clone();
				const w = point.w;
				point.x *= w;
				point.y *= w;
				point.z *= w;
				Pw[ i ] = point;

			}

			for ( let k = 0; k <= du; ++ k ) {

				const point = Pw[ span - p ].clone().multiplyScalar( nders[ k ][ 0 ] );

				for ( let j = 1; j <= p; ++ j ) {

					point.add( Pw[ span - p + j ].clone().multiplyScalar( nders[ k ][ j ] ) );

				}

				CK[ k ] = point;

			}

			for ( let k = du + 1; k <= nd + 1; ++ k ) {

				CK[ k ] = new THREE.Vector4( 0, 0, 0 );

			}

			return CK;

		}
		/*
  Calculate "K over I"
  	returns k!/(i!(k-i)!)
  */


		static calcKoverI( k, i ) {

			let nom = 1;

			for ( let j = 2; j <= k; ++ j ) {

				nom *= j;

			}

			let denom = 1;

			for ( let j = 2; j <= i; ++ j ) {

				denom *= j;

			}

			for ( let j = 2; j <= k - i; ++ j ) {

				denom *= j;

			}

			return nom / denom;

		}
		/*
  Calculate derivatives (0-nd) of rational curve. See The NURBS Book, page 127, algorithm A4.2.
  	Pders : result of function calcBSplineDerivatives
  	returns array with derivatives for rational curve.
  */


		static calcRationalCurveDerivatives( Pders ) {

			const nd = Pders.length;
			const Aders = [];
			const wders = [];

			for ( let i = 0; i < nd; ++ i ) {

				const point = Pders[ i ];
				Aders[ i ] = new THREE.Vector3( point.x, point.y, point.z );
				wders[ i ] = point.w;

			}

			const CK = [];

			for ( let k = 0; k < nd; ++ k ) {

				const v = Aders[ k ].clone();

				for ( let i = 1; i <= k; ++ i ) {

					v.sub( CK[ k - i ].clone().multiplyScalar( this.calcKoverI( k, i ) * wders[ i ] ) );

				}

				CK[ k ] = v.divideScalar( wders[ 0 ] );

			}

			return CK;

		}
		/*
  Calculate NURBS curve derivatives. See The NURBS Book, page 127, algorithm A4.2.
  	p  : degree
  U  : knot vector
  P  : control points in homogeneous space
  u  : parametric points
  nd : number of derivatives
  	returns array with derivatives.
  */


		static calcNURBSDerivatives( p, U, P, u, nd ) {

			const Pders = this.calcBSplineDerivatives( p, U, P, u, nd );
			return this.calcRationalCurveDerivatives( Pders );

		}
		/*
  Calculate rational B-Spline surface point. See The NURBS Book, page 134, algorithm A4.3.
  	p1, p2 : degrees of B-Spline surface
  U1, U2 : knot vectors
  P      : control points (x, y, z, w)
  u, v   : parametric values
  	returns point for given (u, v)
  */


		static calcSurfacePoint( p, q, U, V, P, u, v, target ) {

			const uspan = this.findSpan( p, u, U );
			const vspan = this.findSpan( q, v, V );
			const Nu = this.calcBasisFunctions( uspan, u, p, U );
			const Nv = this.calcBasisFunctions( vspan, v, q, V );
			const temp = [];

			for ( let l = 0; l <= q; ++ l ) {

				temp[ l ] = new THREE.Vector4( 0, 0, 0, 0 );

				for ( let k = 0; k <= p; ++ k ) {

					const point = P[ uspan - p + k ][ vspan - q + l ].clone();
					const w = point.w;
					point.x *= w;
					point.y *= w;
					point.z *= w;
					temp[ l ].add( point.multiplyScalar( Nu[ k ] ) );

				}

			}

			const Sw = new THREE.Vector4( 0, 0, 0, 0 );

			for ( let l = 0; l <= q; ++ l ) {

				Sw.add( temp[ l ].multiplyScalar( Nv[ l ] ) );

			}

			Sw.divideScalar( Sw.w );
			target.set( Sw.x, Sw.y, Sw.z );

		}

	}

	THREE.NURBSUtils = NURBSUtils;

} )();
( function () {

	/**
 * NURBS curve object
 *
 * Derives from THREE.Curve, overriding getPoint and getTangent.
 *
 * Implementation is based on (x, y [, z=0 [, w=1]]) control points with w=weight.
 *
 **/

	class NURBSCurve extends THREE.Curve {

		constructor( degree, knots
			/* array of reals */
			, controlPoints
			/* array of Vector(2|3|4) */
			, startKnot
			/* index in knots */
			, endKnot
			/* index in knots */
		) {

			super();
			this.degree = degree;
			this.knots = knots;
			this.controlPoints = []; // Used by periodic NURBS to remove hidden spans

			this.startKnot = startKnot || 0;
			this.endKnot = endKnot || this.knots.length - 1;

			for ( let i = 0; i < controlPoints.length; ++ i ) {

				// ensure THREE.Vector4 for control points
				const point = controlPoints[ i ];
				this.controlPoints[ i ] = new THREE.Vector4( point.x, point.y, point.z, point.w );

			}

		}

		getPoint( t, optionalTarget = new THREE.Vector3() ) {

			const point = optionalTarget;
			const u = this.knots[ this.startKnot ] + t * ( this.knots[ this.endKnot ] - this.knots[ this.startKnot ] ); // linear mapping t->u
			// following results in (wx, wy, wz, w) homogeneous point

			const hpoint = THREE.NURBSUtils.calcBSplinePoint( this.degree, this.knots, this.controlPoints, u );

			if ( hpoint.w !== 1.0 ) {

				// project to 3D space: (wx, wy, wz, w) -> (x, y, z, 1)
				hpoint.divideScalar( hpoint.w );

			}

			return point.set( hpoint.x, hpoint.y, hpoint.z );

		}

		getTangent( t, optionalTarget = new THREE.Vector3() ) {

			const tangent = optionalTarget;
			const u = this.knots[ 0 ] + t * ( this.knots[ this.knots.length - 1 ] - this.knots[ 0 ] );
			const ders = THREE.NURBSUtils.calcNURBSDerivatives( this.degree, this.knots, this.controlPoints, u, 1 );
			tangent.copy( ders[ 1 ] ).normalize();
			return tangent;

		}

	}

	THREE.NURBSCurve = NURBSCurve;

} )();
( function () {

	/**
 * THREE.Loader loads FBX file and generates THREE.Group representing FBX scene.
 * Requires FBX file to be >= 7.0 and in ASCII or >= 6400 in Binary format
 * Versions lower than this may load but will probably have errors
 *
 * Needs Support:
 *  Morph normals / blend shape normals
 *
 * FBX format references:
 * 	https://wiki.blender.org/index.php/User:Mont29/Foundation/FBX_File_Structure
 * 	http://help.autodesk.com/view/FBX/2017/ENU/?guid=__cpp_ref_index_html (C++ SDK reference)
 *
 * 	Binary format specification:
 *		https://code.blender.org/2013/08/fbx-binary-file-format-specification/
 */

	let fbxTree;
	let connections;
	let sceneGraph;

	class FBXLoader extends THREE.Loader {

		constructor( manager ) {

			super( manager );

		}

		load( url, onLoad, onProgress, onError ) {

			const scope = this;
			const path = scope.path === '' ? THREE.LoaderUtils.extractUrlBase( url ) : scope.path;
			const loader = new THREE.FileLoader( this.manager );
			loader.setPath( scope.path );
			loader.setResponseType( 'arraybuffer' );
			loader.setRequestHeader( scope.requestHeader );
			loader.setWithCredentials( scope.withCredentials );
			loader.load( url, function ( buffer ) {

				try {

					onLoad( scope.parse( buffer, path ) );

				} catch ( e ) {

					if ( onError ) {

						onError( e );

					} else {

						console.error( e );

					}

					scope.manager.itemError( url );

				}

			}, onProgress, onError );

		}

		parse( FBXBuffer, path ) {

			if ( isFbxFormatBinary( FBXBuffer ) ) {

				fbxTree = new BinaryParser().parse( FBXBuffer );

			} else {

				const FBXText = convertArrayBufferToString( FBXBuffer );

				if ( ! isFbxFormatASCII( FBXText ) ) {

					throw new Error( 'THREE.FBXLoader: Unknown format.' );

				}

				if ( getFbxVersion( FBXText ) < 7000 ) {

					throw new Error( 'THREE.FBXLoader: FBX version not supported, FileVersion: ' + getFbxVersion( FBXText ) );

				}

				fbxTree = new TextParser().parse( FBXText );

			} // console.log( fbxTree );


			const textureLoader = new THREE.TextureLoader( this.manager ).setPath( this.resourcePath || path ).setCrossOrigin( this.crossOrigin );
			return new FBXTreeParser( textureLoader, this.manager ).parse( fbxTree );

		}

	} // Parse the FBXTree object returned by the BinaryParser or TextParser and return a THREE.Group


	class FBXTreeParser {

		constructor( textureLoader, manager ) {

			this.textureLoader = textureLoader;
			this.manager = manager;

		}

		parse() {

			connections = this.parseConnections();
			const images = this.parseImages();
			const textures = this.parseTextures( images );
			const materials = this.parseMaterials( textures );
			const deformers = this.parseDeformers();
			const geometryMap = new GeometryParser().parse( deformers );
			this.parseScene( deformers, geometryMap, materials );
			return sceneGraph;

		} // Parses FBXTree.Connections which holds parent-child connections between objects (e.g. material -> texture, model->geometry )
		// and details the connection type


		parseConnections() {

			const connectionMap = new Map();

			if ( 'Connections' in fbxTree ) {

				const rawConnections = fbxTree.Connections.connections;
				rawConnections.forEach( function ( rawConnection ) {

					const fromID = rawConnection[ 0 ];
					const toID = rawConnection[ 1 ];
					const relationship = rawConnection[ 2 ];

					if ( ! connectionMap.has( fromID ) ) {

						connectionMap.set( fromID, {
							parents: [],
							children: []
						} );

					}

					const parentRelationship = {
						ID: toID,
						relationship: relationship
					};
					connectionMap.get( fromID ).parents.push( parentRelationship );

					if ( ! connectionMap.has( toID ) ) {

						connectionMap.set( toID, {
							parents: [],
							children: []
						} );

					}

					const childRelationship = {
						ID: fromID,
						relationship: relationship
					};
					connectionMap.get( toID ).children.push( childRelationship );

				} );

			}

			return connectionMap;

		} // Parse FBXTree.Objects.Video for embedded image data
		// These images are connected to textures in FBXTree.Objects.Textures
		// via FBXTree.Connections.


		parseImages() {

			const images = {};
			const blobs = {};

			if ( 'Video' in fbxTree.Objects ) {

				const videoNodes = fbxTree.Objects.Video;

				for ( const nodeID in videoNodes ) {

					const videoNode = videoNodes[ nodeID ];
					const id = parseInt( nodeID );
					images[ id ] = videoNode.RelativeFilename || videoNode.Filename; // raw image data is in videoNode.Content

					if ( 'Content' in videoNode ) {

						const arrayBufferContent = videoNode.Content instanceof ArrayBuffer && videoNode.Content.byteLength > 0;
						const base64Content = typeof videoNode.Content === 'string' && videoNode.Content !== '';

						if ( arrayBufferContent || base64Content ) {

							const image = this.parseImage( videoNodes[ nodeID ] );
							blobs[ videoNode.RelativeFilename || videoNode.Filename ] = image;

						}

					}

				}

			}

			for ( const id in images ) {

				const filename = images[ id ];
				if ( blobs[ filename ] !== undefined ) images[ id ] = blobs[ filename ]; else images[ id ] = images[ id ].split( '\\' ).pop();

			}

			return images;

		} // Parse embedded image data in FBXTree.Video.Content


		parseImage( videoNode ) {

			const content = videoNode.Content;
			const fileName = videoNode.RelativeFilename || videoNode.Filename;
			const extension = fileName.slice( fileName.lastIndexOf( '.' ) + 1 ).toLowerCase();
			let type;

			switch ( extension ) {

				case 'bmp':
					type = 'image/bmp';
					break;

				case 'jpg':
				case 'jpeg':
					type = 'image/jpeg';
					break;

				case 'png':
					type = 'image/png';
					break;

				case 'tif':
					type = 'image/tiff';
					break;

				case 'tga':
					if ( this.manager.getHandler( '.tga' ) === null ) {

						console.warn( 'FBXLoader: TGA loader not found, skipping ', fileName );

					}

					type = 'image/tga';
					break;

				default:
					console.warn( 'FBXLoader: Image type "' + extension + '" is not supported.' );
					return;

			}

			if ( typeof content === 'string' ) {

				// ASCII format
				return 'data:' + type + ';base64,' + content;

			} else {

				// Binary Format
				const array = new Uint8Array( content );
				return window.URL.createObjectURL( new Blob( [ array ], {
					type: type
				} ) );

			}

		} // Parse nodes in FBXTree.Objects.Texture
		// These contain details such as UV scaling, cropping, rotation etc and are connected
		// to images in FBXTree.Objects.Video


		parseTextures( images ) {

			const textureMap = new Map();

			if ( 'Texture' in fbxTree.Objects ) {

				const textureNodes = fbxTree.Objects.Texture;

				for ( const nodeID in textureNodes ) {

					const texture = this.parseTexture( textureNodes[ nodeID ], images );
					textureMap.set( parseInt( nodeID ), texture );

				}

			}

			return textureMap;

		} // Parse individual node in FBXTree.Objects.Texture


		parseTexture( textureNode, images ) {

			const texture = this.loadTexture( textureNode, images );
			texture.ID = textureNode.id;
			texture.name = textureNode.attrName;
			const wrapModeU = textureNode.WrapModeU;
			const wrapModeV = textureNode.WrapModeV;
			const valueU = wrapModeU !== undefined ? wrapModeU.value : 0;
			const valueV = wrapModeV !== undefined ? wrapModeV.value : 0; // http://download.autodesk.com/us/fbx/SDKdocs/FBX_SDK_Help/files/fbxsdkref/class_k_fbx_texture.html#889640e63e2e681259ea81061b85143a
			// 0: repeat(default), 1: clamp

			texture.wrapS = valueU === 0 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
			texture.wrapT = valueV === 0 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;

			if ( 'Scaling' in textureNode ) {

				const values = textureNode.Scaling.value;
				texture.repeat.x = values[ 0 ];
				texture.repeat.y = values[ 1 ];

			}

			return texture;

		} // load a texture specified as a blob or data URI, or via an external URL using THREE.TextureLoader


		loadTexture( textureNode, images ) {

			let fileName;
			const currentPath = this.textureLoader.path;
			const children = connections.get( textureNode.id ).children;

			if ( children !== undefined && children.length > 0 && images[ children[ 0 ].ID ] !== undefined ) {

				fileName = images[ children[ 0 ].ID ];

				if ( fileName.indexOf( 'blob:' ) === 0 || fileName.indexOf( 'data:' ) === 0 ) {

					this.textureLoader.setPath( undefined );

				}

			}

			let texture;
			const extension = textureNode.FileName.slice( - 3 ).toLowerCase();

			if ( extension === 'tga' ) {

				const loader = this.manager.getHandler( '.tga' );

				if ( loader === null ) {

					console.warn( 'FBXLoader: TGA loader not found, creating placeholder texture for', textureNode.RelativeFilename );
					texture = new THREE.Texture();

				} else {

					texture = loader.load( fileName );

				}

			} else if ( extension === 'psd' ) {

				console.warn( 'FBXLoader: PSD textures are not supported, creating placeholder texture for', textureNode.RelativeFilename );
				texture = new THREE.Texture();

			} else {

				texture = this.textureLoader.load( fileName );

			}

			this.textureLoader.setPath( currentPath );
			return texture;

		} // Parse nodes in FBXTree.Objects.Material


		parseMaterials( textureMap ) {

			const materialMap = new Map();

			if ( 'Material' in fbxTree.Objects ) {

				const materialNodes = fbxTree.Objects.Material;

				for ( const nodeID in materialNodes ) {

					const material = this.parseMaterial( materialNodes[ nodeID ], textureMap );
					if ( material !== null ) materialMap.set( parseInt( nodeID ), material );

				}

			}

			return materialMap;

		} // Parse single node in FBXTree.Objects.Material
		// Materials are connected to texture maps in FBXTree.Objects.Textures
		// FBX format currently only supports Lambert and Phong shading models


		parseMaterial( materialNode, textureMap ) {

			const ID = materialNode.id;
			const name = materialNode.attrName;
			let type = materialNode.ShadingModel; // Case where FBX wraps shading model in property object.

			if ( typeof type === 'object' ) {

				type = type.value;

			} // Ignore unused materials which don't have any connections.


			if ( ! connections.has( ID ) ) return null;
			const parameters = this.parseParameters( materialNode, textureMap, ID );
			let material;

			switch ( type.toLowerCase() ) {

				case 'phong':
					material = new THREE.MeshPhongMaterial();
					break;

				case 'lambert':
					material = new THREE.MeshLambertMaterial();
					break;

				default:
					console.warn( 'THREE.FBXLoader: unknown material type "%s". Defaulting to THREE.MeshPhongMaterial.', type );
					material = new THREE.MeshPhongMaterial();
					break;

			}

			material.setValues( parameters );
			material.name = name;
			return material;

		} // Parse FBX material and return parameters suitable for a three.js material
		// Also parse the texture map and return any textures associated with the material


		parseParameters( materialNode, textureMap, ID ) {

			const parameters = {};

			if ( materialNode.BumpFactor ) {

				parameters.bumpScale = materialNode.BumpFactor.value;

			}

			if ( materialNode.Diffuse ) {

				parameters.color = new THREE.Color().fromArray( materialNode.Diffuse.value );

			} else if ( materialNode.DiffuseColor && ( materialNode.DiffuseColor.type === 'Color' || materialNode.DiffuseColor.type === 'ColorRGB' ) ) {

				// The blender exporter exports diffuse here instead of in materialNode.Diffuse
				parameters.color = new THREE.Color().fromArray( materialNode.DiffuseColor.value );

			}

			if ( materialNode.DisplacementFactor ) {

				parameters.displacementScale = materialNode.DisplacementFactor.value;

			}

			if ( materialNode.Emissive ) {

				parameters.emissive = new THREE.Color().fromArray( materialNode.Emissive.value );

			} else if ( materialNode.EmissiveColor && ( materialNode.EmissiveColor.type === 'Color' || materialNode.EmissiveColor.type === 'ColorRGB' ) ) {

				// The blender exporter exports emissive color here instead of in materialNode.Emissive
				parameters.emissive = new THREE.Color().fromArray( materialNode.EmissiveColor.value );

			}

			if ( materialNode.EmissiveFactor ) {

				parameters.emissiveIntensity = parseFloat( materialNode.EmissiveFactor.value );

			}

			if ( materialNode.Opacity ) {

				parameters.opacity = parseFloat( materialNode.Opacity.value );

			}

			if ( parameters.opacity < 1.0 ) {

				parameters.transparent = true;

			}

			if ( materialNode.ReflectionFactor ) {

				parameters.reflectivity = materialNode.ReflectionFactor.value;

			}

			if ( materialNode.Shininess ) {

				parameters.shininess = materialNode.Shininess.value;

			}

			if ( materialNode.Specular ) {

				parameters.specular = new THREE.Color().fromArray( materialNode.Specular.value );

			} else if ( materialNode.SpecularColor && materialNode.SpecularColor.type === 'Color' ) {

				// The blender exporter exports specular color here instead of in materialNode.Specular
				parameters.specular = new THREE.Color().fromArray( materialNode.SpecularColor.value );

			}

			const scope = this;
			connections.get( ID ).children.forEach( function ( child ) {

				const type = child.relationship;

				switch ( type ) {

					case 'Bump':
						parameters.bumpMap = scope.getTexture( textureMap, child.ID );
						break;

					case 'Maya|TEX_ao_map':
						parameters.aoMap = scope.getTexture( textureMap, child.ID );
						break;

					case 'DiffuseColor':
					case 'Maya|TEX_color_map':
						parameters.map = scope.getTexture( textureMap, child.ID );
						parameters.map.encoding = THREE.sRGBEncoding;
						break;

					case 'DisplacementColor':
						parameters.displacementMap = scope.getTexture( textureMap, child.ID );
						break;

					case 'EmissiveColor':
						parameters.emissiveMap = scope.getTexture( textureMap, child.ID );
						parameters.emissiveMap.encoding = THREE.sRGBEncoding;
						break;

					case 'NormalMap':
					case 'Maya|TEX_normal_map':
						parameters.normalMap = scope.getTexture( textureMap, child.ID );
						break;

					case 'ReflectionColor':
						parameters.envMap = scope.getTexture( textureMap, child.ID );
						parameters.envMap.mapping = THREE.EquirectangularReflectionMapping;
						parameters.envMap.encoding = THREE.sRGBEncoding;
						break;

					case 'SpecularColor':
						parameters.specularMap = scope.getTexture( textureMap, child.ID );
						parameters.specularMap.encoding = THREE.sRGBEncoding;
						break;

					case 'TransparentColor':
					case 'TransparencyFactor':
						parameters.alphaMap = scope.getTexture( textureMap, child.ID );
						parameters.transparent = true;
						break;

					case 'AmbientColor':
					case 'ShininessExponent': // AKA glossiness map

					case 'SpecularFactor': // AKA specularLevel

					case 'VectorDisplacementColor': // NOTE: Seems to be a copy of DisplacementColor

					default:
						console.warn( 'THREE.FBXLoader: %s map is not supported in three.js, skipping texture.', type );
						break;

				}

			} );
			return parameters;

		} // get a texture from the textureMap for use by a material.


		getTexture( textureMap, id ) {

			// if the texture is a layered texture, just use the first layer and issue a warning
			if ( 'LayeredTexture' in fbxTree.Objects && id in fbxTree.Objects.LayeredTexture ) {

				console.warn( 'THREE.FBXLoader: layered textures are not supported in three.js. Discarding all but first layer.' );
				id = connections.get( id ).children[ 0 ].ID;

			}

			return textureMap.get( id );

		} // Parse nodes in FBXTree.Objects.Deformer
		// Deformer node can contain skinning or Vertex Cache animation data, however only skinning is supported here
		// Generates map of THREE.Skeleton-like objects for use later when generating and binding skeletons.


		parseDeformers() {

			const skeletons = {};
			const morphTargets = {};

			if ( 'Deformer' in fbxTree.Objects ) {

				const DeformerNodes = fbxTree.Objects.Deformer;

				for ( const nodeID in DeformerNodes ) {

					const deformerNode = DeformerNodes[ nodeID ];
					const relationships = connections.get( parseInt( nodeID ) );

					if ( deformerNode.attrType === 'Skin' ) {

						const skeleton = this.parseSkeleton( relationships, DeformerNodes );
						skeleton.ID = nodeID;
						if ( relationships.parents.length > 1 ) console.warn( 'THREE.FBXLoader: skeleton attached to more than one geometry is not supported.' );
						skeleton.geometryID = relationships.parents[ 0 ].ID;
						skeletons[ nodeID ] = skeleton;

					} else if ( deformerNode.attrType === 'BlendShape' ) {

						const morphTarget = {
							id: nodeID
						};
						morphTarget.rawTargets = this.parseMorphTargets( relationships, DeformerNodes );
						morphTarget.id = nodeID;
						if ( relationships.parents.length > 1 ) console.warn( 'THREE.FBXLoader: morph target attached to more than one geometry is not supported.' );
						morphTargets[ nodeID ] = morphTarget;

					}

				}

			}

			return {
				skeletons: skeletons,
				morphTargets: morphTargets
			};

		} // Parse single nodes in FBXTree.Objects.Deformer
		// The top level skeleton node has type 'Skin' and sub nodes have type 'Cluster'
		// Each skin node represents a skeleton and each cluster node represents a bone


		parseSkeleton( relationships, deformerNodes ) {

			const rawBones = [];
			relationships.children.forEach( function ( child ) {

				const boneNode = deformerNodes[ child.ID ];
				if ( boneNode.attrType !== 'Cluster' ) return;
				const rawBone = {
					ID: child.ID,
					indices: [],
					weights: [],
					transformLink: new THREE.Matrix4().fromArray( boneNode.TransformLink.a ) // transform: new THREE.Matrix4().fromArray( boneNode.Transform.a ),
					// linkMode: boneNode.Mode,

				};

				if ( 'Indexes' in boneNode ) {

					rawBone.indices = boneNode.Indexes.a;
					rawBone.weights = boneNode.Weights.a;

				}

				rawBones.push( rawBone );

			} );
			return {
				rawBones: rawBones,
				bones: []
			};

		} // The top level morph deformer node has type "BlendShape" and sub nodes have type "BlendShapeChannel"


		parseMorphTargets( relationships, deformerNodes ) {

			const rawMorphTargets = [];

			for ( let i = 0; i < relationships.children.length; i ++ ) {

				const child = relationships.children[ i ];
				const morphTargetNode = deformerNodes[ child.ID ];
				const rawMorphTarget = {
					name: morphTargetNode.attrName,
					initialWeight: morphTargetNode.DeformPercent,
					id: morphTargetNode.id,
					fullWeights: morphTargetNode.FullWeights.a
				};
				if ( morphTargetNode.attrType !== 'BlendShapeChannel' ) return;
				rawMorphTarget.geoID = connections.get( parseInt( child.ID ) ).children.filter( function ( child ) {

					return child.relationship === undefined;

				} )[ 0 ].ID;
				rawMorphTargets.push( rawMorphTarget );

			}

			return rawMorphTargets;

		} // create the main THREE.Group() to be returned by the loader


		parseScene( deformers, geometryMap, materialMap ) {

			sceneGraph = new THREE.Group();
			const modelMap = this.parseModels( deformers.skeletons, geometryMap, materialMap );
			const modelNodes = fbxTree.Objects.Model;
			const scope = this;
			modelMap.forEach( function ( model ) {

				const modelNode = modelNodes[ model.ID ];
				scope.setLookAtProperties( model, modelNode );
				const parentConnections = connections.get( model.ID ).parents;
				parentConnections.forEach( function ( connection ) {

					const parent = modelMap.get( connection.ID );
					if ( parent !== undefined ) parent.add( model );

				} );

				if ( model.parent === null ) {

					sceneGraph.add( model );

				}

			} );
			this.bindSkeleton( deformers.skeletons, geometryMap, modelMap );
			this.createAmbientLight();
			this.setupMorphMaterials();
			sceneGraph.traverse( function ( node ) {

				if ( node.userData.transformData ) {

					if ( node.parent ) {

						node.userData.transformData.parentMatrix = node.parent.matrix;
						node.userData.transformData.parentMatrixWorld = node.parent.matrixWorld;

					}

					const transform = generateTransform( node.userData.transformData );
					node.applyMatrix4( transform );
					node.updateWorldMatrix();

				}

			} );
			const animations = new AnimationParser().parse(); // if all the models where already combined in a single group, just return that

			if ( sceneGraph.children.length === 1 && sceneGraph.children[ 0 ].isGroup ) {

				sceneGraph.children[ 0 ].animations = animations;
				sceneGraph = sceneGraph.children[ 0 ];

			}

			sceneGraph.animations = animations;

		} // parse nodes in FBXTree.Objects.Model


		parseModels( skeletons, geometryMap, materialMap ) {

			const modelMap = new Map();
			const modelNodes = fbxTree.Objects.Model;

			for ( const nodeID in modelNodes ) {

				const id = parseInt( nodeID );
				const node = modelNodes[ nodeID ];
				const relationships = connections.get( id );
				let model = this.buildSkeleton( relationships, skeletons, id, node.attrName );

				if ( ! model ) {

					switch ( node.attrType ) {

						case 'Camera':
							model = this.createCamera( relationships );
							break;

						case 'Light':
							model = this.createLight( relationships );
							break;

						case 'Mesh':
							model = this.createMesh( relationships, geometryMap, materialMap );
							break;

						case 'NurbsCurve':
							model = this.createCurve( relationships, geometryMap );
							break;

						case 'LimbNode':
						case 'Root':
							model = new THREE.Bone();
							break;

						case 'Null':
						default:
							model = new THREE.Group();
							break;

					}

					model.name = node.attrName ? THREE.PropertyBinding.sanitizeNodeName( node.attrName ) : '';
					model.ID = id;

				}

				this.getTransformData( model, node );
				modelMap.set( id, model );

			}

			return modelMap;

		}

		buildSkeleton( relationships, skeletons, id, name ) {

			let bone = null;
			relationships.parents.forEach( function ( parent ) {

				for ( const ID in skeletons ) {

					const skeleton = skeletons[ ID ];
					skeleton.rawBones.forEach( function ( rawBone, i ) {

						if ( rawBone.ID === parent.ID ) {

							const subBone = bone;
							bone = new THREE.Bone();
							bone.matrixWorld.copy( rawBone.transformLink ); // set name and id here - otherwise in cases where "subBone" is created it will not have a name / id

							bone.name = name ? THREE.PropertyBinding.sanitizeNodeName( name ) : '';
							bone.ID = id;
							skeleton.bones[ i ] = bone; // In cases where a bone is shared between multiple meshes
							// duplicate the bone here and and it as a child of the first bone

							if ( subBone !== null ) {

								bone.add( subBone );

							}

						}

					} );

				}

			} );
			return bone;

		} // create a THREE.PerspectiveCamera or THREE.OrthographicCamera


		createCamera( relationships ) {

			let model;
			let cameraAttribute;
			relationships.children.forEach( function ( child ) {

				const attr = fbxTree.Objects.NodeAttribute[ child.ID ];

				if ( attr !== undefined ) {

					cameraAttribute = attr;

				}

			} );

			if ( cameraAttribute === undefined ) {

				model = new THREE.Object3D();

			} else {

				let type = 0;

				if ( cameraAttribute.CameraProjectionType !== undefined && cameraAttribute.CameraProjectionType.value === 1 ) {

					type = 1;

				}

				let nearClippingPlane = 1;

				if ( cameraAttribute.NearPlane !== undefined ) {

					nearClippingPlane = cameraAttribute.NearPlane.value / 1000;

				}

				let farClippingPlane = 1000;

				if ( cameraAttribute.FarPlane !== undefined ) {

					farClippingPlane = cameraAttribute.FarPlane.value / 1000;

				}

				let width = window.innerWidth;
				let height = window.innerHeight;

				if ( cameraAttribute.AspectWidth !== undefined && cameraAttribute.AspectHeight !== undefined ) {

					width = cameraAttribute.AspectWidth.value;
					height = cameraAttribute.AspectHeight.value;

				}

				const aspect = width / height;
				let fov = 45;

				if ( cameraAttribute.FieldOfView !== undefined ) {

					fov = cameraAttribute.FieldOfView.value;

				}

				const focalLength = cameraAttribute.FocalLength ? cameraAttribute.FocalLength.value : null;

				switch ( type ) {

					case 0:
						// Perspective
						model = new THREE.PerspectiveCamera( fov, aspect, nearClippingPlane, farClippingPlane );
						if ( focalLength !== null ) model.setFocalLength( focalLength );
						break;

					case 1:
						// Orthographic
						model = new THREE.OrthographicCamera( - width / 2, width / 2, height / 2, - height / 2, nearClippingPlane, farClippingPlane );
						break;

					default:
						console.warn( 'THREE.FBXLoader: Unknown camera type ' + type + '.' );
						model = new THREE.Object3D();
						break;

				}

			}

			return model;

		} // Create a THREE.DirectionalLight, THREE.PointLight or THREE.SpotLight


		createLight( relationships ) {

			let model;
			let lightAttribute;
			relationships.children.forEach( function ( child ) {

				const attr = fbxTree.Objects.NodeAttribute[ child.ID ];

				if ( attr !== undefined ) {

					lightAttribute = attr;

				}

			} );

			if ( lightAttribute === undefined ) {

				model = new THREE.Object3D();

			} else {

				let type; // LightType can be undefined for Point lights

				if ( lightAttribute.LightType === undefined ) {

					type = 0;

				} else {

					type = lightAttribute.LightType.value;

				}

				let color = 0xffffff;

				if ( lightAttribute.Color !== undefined ) {

					color = new THREE.Color().fromArray( lightAttribute.Color.value );

				}

				let intensity = lightAttribute.Intensity === undefined ? 1 : lightAttribute.Intensity.value / 100; // light disabled

				if ( lightAttribute.CastLightOnObject !== undefined && lightAttribute.CastLightOnObject.value === 0 ) {

					intensity = 0;

				}

				let distance = 0;

				if ( lightAttribute.FarAttenuationEnd !== undefined ) {

					if ( lightAttribute.EnableFarAttenuation !== undefined && lightAttribute.EnableFarAttenuation.value === 0 ) {

						distance = 0;

					} else {

						distance = lightAttribute.FarAttenuationEnd.value;

					}

				} // TODO: could this be calculated linearly from FarAttenuationStart to FarAttenuationEnd?


				const decay = 1;

				switch ( type ) {

					case 0:
						// Point
						model = new THREE.PointLight( color, intensity, distance, decay );
						break;

					case 1:
						// Directional
						model = new THREE.DirectionalLight( color, intensity );
						break;

					case 2:
						// Spot
						let angle = Math.PI / 3;

						if ( lightAttribute.InnerAngle !== undefined ) {

							angle = THREE.MathUtils.degToRad( lightAttribute.InnerAngle.value );

						}

						let penumbra = 0;

						if ( lightAttribute.OuterAngle !== undefined ) {

							// TODO: this is not correct - FBX calculates outer and inner angle in degrees
							// with OuterAngle > InnerAngle && OuterAngle <= Math.PI
							// while three.js uses a penumbra between (0, 1) to attenuate the inner angle
							penumbra = THREE.MathUtils.degToRad( lightAttribute.OuterAngle.value );
							penumbra = Math.max( penumbra, 1 );

						}

						model = new THREE.SpotLight( color, intensity, distance, angle, penumbra, decay );
						break;

					default:
						console.warn( 'THREE.FBXLoader: Unknown light type ' + lightAttribute.LightType.value + ', defaulting to a THREE.PointLight.' );
						model = new THREE.PointLight( color, intensity );
						break;

				}

				if ( lightAttribute.CastShadows !== undefined && lightAttribute.CastShadows.value === 1 ) {

					model.castShadow = true;

				}

			}

			return model;

		}

		createMesh( relationships, geometryMap, materialMap ) {

			let model;
			let geometry = null;
			let material = null;
			const materials = []; // get geometry and materials(s) from connections

			relationships.children.forEach( function ( child ) {

				if ( geometryMap.has( child.ID ) ) {

					geometry = geometryMap.get( child.ID );

				}

				if ( materialMap.has( child.ID ) ) {

					materials.push( materialMap.get( child.ID ) );

				}

			} );

			if ( materials.length > 1 ) {

				material = materials;

			} else if ( materials.length > 0 ) {

				material = materials[ 0 ];

			} else {

				material = new THREE.MeshPhongMaterial( {
					color: 0xcccccc
				} );
				materials.push( material );

			}

			if ( 'color' in geometry.attributes ) {

				materials.forEach( function ( material ) {

					material.vertexColors = true;

				} );

			}

			if ( geometry.FBX_Deformer ) {

				materials.forEach( function ( material ) {

					material.skinning = true;

				} );
				model = new THREE.SkinnedMesh( geometry, material );
				model.normalizeSkinWeights();

			} else {

				model = new THREE.Mesh( geometry, material );

			}

			return model;

		}

		createCurve( relationships, geometryMap ) {

			const geometry = relationships.children.reduce( function ( geo, child ) {

				if ( geometryMap.has( child.ID ) ) geo = geometryMap.get( child.ID );
				return geo;

			}, null ); // FBX does not list materials for Nurbs lines, so we'll just put our own in here.

			const material = new THREE.LineBasicMaterial( {
				color: 0x3300ff,
				linewidth: 1
			} );
			return new THREE.Line( geometry, material );

		} // parse the model node for transform data


		getTransformData( model, modelNode ) {

			const transformData = {};
			if ( 'InheritType' in modelNode ) transformData.inheritType = parseInt( modelNode.InheritType.value );
			if ( 'RotationOrder' in modelNode ) transformData.eulerOrder = getEulerOrder( modelNode.RotationOrder.value ); else transformData.eulerOrder = 'ZYX';
			if ( 'Lcl_Translation' in modelNode ) transformData.translation = modelNode.Lcl_Translation.value;
			if ( 'PreRotation' in modelNode ) transformData.preRotation = modelNode.PreRotation.value;
			if ( 'Lcl_Rotation' in modelNode ) transformData.rotation = modelNode.Lcl_Rotation.value;
			if ( 'PostRotation' in modelNode ) transformData.postRotation = modelNode.PostRotation.value;
			if ( 'Lcl_Scaling' in modelNode ) transformData.scale = modelNode.Lcl_Scaling.value;
			if ( 'ScalingOffset' in modelNode ) transformData.scalingOffset = modelNode.ScalingOffset.value;
			if ( 'ScalingPivot' in modelNode ) transformData.scalingPivot = modelNode.ScalingPivot.value;
			if ( 'RotationOffset' in modelNode ) transformData.rotationOffset = modelNode.RotationOffset.value;
			if ( 'RotationPivot' in modelNode ) transformData.rotationPivot = modelNode.RotationPivot.value;
			model.userData.transformData = transformData;

		}

		setLookAtProperties( model, modelNode ) {

			if ( 'LookAtProperty' in modelNode ) {

				const children = connections.get( model.ID ).children;
				children.forEach( function ( child ) {

					if ( child.relationship === 'LookAtProperty' ) {

						const lookAtTarget = fbxTree.Objects.Model[ child.ID ];

						if ( 'Lcl_Translation' in lookAtTarget ) {

							const pos = lookAtTarget.Lcl_Translation.value; // THREE.DirectionalLight, THREE.SpotLight

							if ( model.target !== undefined ) {

								model.target.position.fromArray( pos );
								sceneGraph.add( model.target );

							} else {

								// Cameras and other Object3Ds
								model.lookAt( new THREE.Vector3().fromArray( pos ) );

							}

						}

					}

				} );

			}

		}

		bindSkeleton( skeletons, geometryMap, modelMap ) {

			const bindMatrices = this.parsePoseNodes();

			for ( const ID in skeletons ) {

				const skeleton = skeletons[ ID ];
				const parents = connections.get( parseInt( skeleton.ID ) ).parents;
				parents.forEach( function ( parent ) {

					if ( geometryMap.has( parent.ID ) ) {

						const geoID = parent.ID;
						const geoRelationships = connections.get( geoID );
						geoRelationships.parents.forEach( function ( geoConnParent ) {

							if ( modelMap.has( geoConnParent.ID ) ) {

								const model = modelMap.get( geoConnParent.ID );
								model.bind( new THREE.Skeleton( skeleton.bones ), bindMatrices[ geoConnParent.ID ] );

							}

						} );

					}

				} );

			}

		}

		parsePoseNodes() {

			const bindMatrices = {};

			if ( 'Pose' in fbxTree.Objects ) {

				const BindPoseNode = fbxTree.Objects.Pose;

				for ( const nodeID in BindPoseNode ) {

					if ( BindPoseNode[ nodeID ].attrType === 'BindPose' ) {

						const poseNodes = BindPoseNode[ nodeID ].PoseNode;

						if ( Array.isArray( poseNodes ) ) {

							poseNodes.forEach( function ( poseNode ) {

								bindMatrices[ poseNode.Node ] = new THREE.Matrix4().fromArray( poseNode.Matrix.a );

							} );

						} else {

							bindMatrices[ poseNodes.Node ] = new THREE.Matrix4().fromArray( poseNodes.Matrix.a );

						}

					}

				}

			}

			return bindMatrices;

		} // Parse ambient color in FBXTree.GlobalSettings - if it's not set to black (default), create an ambient light


		createAmbientLight() {

			if ( 'GlobalSettings' in fbxTree && 'AmbientColor' in fbxTree.GlobalSettings ) {

				const ambientColor = fbxTree.GlobalSettings.AmbientColor.value;
				const r = ambientColor[ 0 ];
				const g = ambientColor[ 1 ];
				const b = ambientColor[ 2 ];

				if ( r !== 0 || g !== 0 || b !== 0 ) {

					const color = new THREE.Color( r, g, b );
					sceneGraph.add( new THREE.AmbientLight( color, 1 ) );

				}

			}

		}

		setupMorphMaterials() {

			const scope = this;
			sceneGraph.traverse( function ( child ) {

				if ( child.isMesh ) {

					if ( child.geometry.morphAttributes.position && child.geometry.morphAttributes.position.length ) {

						if ( Array.isArray( child.material ) ) {

							child.material.forEach( function ( material, i ) {

								scope.setupMorphMaterial( child, material, i );

							} );

						} else {

							scope.setupMorphMaterial( child, child.material );

						}

					}

				}

			} );

		}

		setupMorphMaterial( child, material, index ) {

			const uuid = child.uuid;
			const matUuid = material.uuid; // if a geometry has morph targets, it cannot share the material with other geometries

			let sharedMat = false;
			sceneGraph.traverse( function ( node ) {

				if ( node.isMesh ) {

					if ( Array.isArray( node.material ) ) {

						node.material.forEach( function ( mat ) {

							if ( mat.uuid === matUuid && node.uuid !== uuid ) sharedMat = true;

						} );

					} else if ( node.material.uuid === matUuid && node.uuid !== uuid ) sharedMat = true;

				}

			} );

			if ( sharedMat === true ) {

				const clonedMat = material.clone();
				clonedMat.morphTargets = true;
				if ( index === undefined ) child.material = clonedMat; else child.material[ index ] = clonedMat;

			} else material.morphTargets = true;

		}

	} // parse Geometry data from FBXTree and return map of BufferGeometries


	class GeometryParser {

		// Parse nodes in FBXTree.Objects.Geometry
		parse( deformers ) {

			const geometryMap = new Map();

			if ( 'Geometry' in fbxTree.Objects ) {

				const geoNodes = fbxTree.Objects.Geometry;

				for ( const nodeID in geoNodes ) {

					const relationships = connections.get( parseInt( nodeID ) );
					const geo = this.parseGeometry( relationships, geoNodes[ nodeID ], deformers );
					geometryMap.set( parseInt( nodeID ), geo );

				}

			}

			return geometryMap;

		} // Parse single node in FBXTree.Objects.Geometry


		parseGeometry( relationships, geoNode, deformers ) {

			switch ( geoNode.attrType ) {

				case 'Mesh':
					return this.parseMeshGeometry( relationships, geoNode, deformers );
					break;

				case 'NurbsCurve':
					return this.parseNurbsGeometry( geoNode );
					break;

			}

		} // Parse single node mesh geometry in FBXTree.Objects.Geometry


		parseMeshGeometry( relationships, geoNode, deformers ) {

			const skeletons = deformers.skeletons;
			const morphTargets = [];
			const modelNodes = relationships.parents.map( function ( parent ) {

				return fbxTree.Objects.Model[ parent.ID ];

			} ); // don't create geometry if it is not associated with any models

			if ( modelNodes.length === 0 ) return;
			const skeleton = relationships.children.reduce( function ( skeleton, child ) {

				if ( skeletons[ child.ID ] !== undefined ) skeleton = skeletons[ child.ID ];
				return skeleton;

			}, null );
			relationships.children.forEach( function ( child ) {

				if ( deformers.morphTargets[ child.ID ] !== undefined ) {

					morphTargets.push( deformers.morphTargets[ child.ID ] );

				}

			} ); // Assume one model and get the preRotation from that
			// if there is more than one model associated with the geometry this may cause problems

			const modelNode = modelNodes[ 0 ];
			const transformData = {};
			if ( 'RotationOrder' in modelNode ) transformData.eulerOrder = getEulerOrder( modelNode.RotationOrder.value );
			if ( 'InheritType' in modelNode ) transformData.inheritType = parseInt( modelNode.InheritType.value );
			if ( 'GeometricTranslation' in modelNode ) transformData.translation = modelNode.GeometricTranslation.value;
			if ( 'GeometricRotation' in modelNode ) transformData.rotation = modelNode.GeometricRotation.value;
			if ( 'GeometricScaling' in modelNode ) transformData.scale = modelNode.GeometricScaling.value;
			const transform = generateTransform( transformData );
			return this.genGeometry( geoNode, skeleton, morphTargets, transform );

		} // Generate a THREE.BufferGeometry from a node in FBXTree.Objects.Geometry


		genGeometry( geoNode, skeleton, morphTargets, preTransform ) {

			const geo = new THREE.BufferGeometry();
			if ( geoNode.attrName ) geo.name = geoNode.attrName;
			const geoInfo = this.parseGeoNode( geoNode, skeleton );
			const buffers = this.genBuffers( geoInfo );
			const positionAttribute = new THREE.Float32BufferAttribute( buffers.vertex, 3 );
			positionAttribute.applyMatrix4( preTransform );
			geo.setAttribute( 'position', positionAttribute );

			if ( buffers.colors.length > 0 ) {

				geo.setAttribute( 'color', new THREE.Float32BufferAttribute( buffers.colors, 3 ) );

			}

			if ( skeleton ) {

				geo.setAttribute( 'skinIndex', new THREE.Uint16BufferAttribute( buffers.weightsIndices, 4 ) );
				geo.setAttribute( 'skinWeight', new THREE.Float32BufferAttribute( buffers.vertexWeights, 4 ) ); // used later to bind the skeleton to the model

				geo.FBX_Deformer = skeleton;

			}

			if ( buffers.normal.length > 0 ) {

				const normalMatrix = new THREE.Matrix3().getNormalMatrix( preTransform );
				const normalAttribute = new THREE.Float32BufferAttribute( buffers.normal, 3 );
				normalAttribute.applyNormalMatrix( normalMatrix );
				geo.setAttribute( 'normal', normalAttribute );

			}

			buffers.uvs.forEach( function ( uvBuffer, i ) {

				// subsequent uv buffers are called 'uv1', 'uv2', ...
				let name = 'uv' + ( i + 1 ).toString(); // the first uv buffer is just called 'uv'

				if ( i === 0 ) {

					name = 'uv';

				}

				geo.setAttribute( name, new THREE.Float32BufferAttribute( buffers.uvs[ i ], 2 ) );

			} );

			if ( geoInfo.material && geoInfo.material.mappingType !== 'AllSame' ) {

				// Convert the material indices of each vertex into rendering groups on the geometry.
				let prevMaterialIndex = buffers.materialIndex[ 0 ];
				let startIndex = 0;
				buffers.materialIndex.forEach( function ( currentIndex, i ) {

					if ( currentIndex !== prevMaterialIndex ) {

						geo.addGroup( startIndex, i - startIndex, prevMaterialIndex );
						prevMaterialIndex = currentIndex;
						startIndex = i;

					}

				} ); // the loop above doesn't add the last group, do that here.

				if ( geo.groups.length > 0 ) {

					const lastGroup = geo.groups[ geo.groups.length - 1 ];
					const lastIndex = lastGroup.start + lastGroup.count;

					if ( lastIndex !== buffers.materialIndex.length ) {

						geo.addGroup( lastIndex, buffers.materialIndex.length - lastIndex, prevMaterialIndex );

					}

				} // case where there are multiple materials but the whole geometry is only
				// using one of them


				if ( geo.groups.length === 0 ) {

					geo.addGroup( 0, buffers.materialIndex.length, buffers.materialIndex[ 0 ] );

				}

			}

			this.addMorphTargets( geo, geoNode, morphTargets, preTransform );
			return geo;

		}

		parseGeoNode( geoNode, skeleton ) {

			const geoInfo = {};
			geoInfo.vertexPositions = geoNode.Vertices !== undefined ? geoNode.Vertices.a : [];
			geoInfo.vertexIndices = geoNode.PolygonVertexIndex !== undefined ? geoNode.PolygonVertexIndex.a : [];

			if ( geoNode.LayerElementColor ) {

				geoInfo.color = this.parseVertexColors( geoNode.LayerElementColor[ 0 ] );

			}

			if ( geoNode.LayerElementMaterial ) {

				geoInfo.material = this.parseMaterialIndices( geoNode.LayerElementMaterial[ 0 ] );

			}

			if ( geoNode.LayerElementNormal ) {

				geoInfo.normal = this.parseNormals( geoNode.LayerElementNormal[ 0 ] );

			}

			if ( geoNode.LayerElementUV ) {

				geoInfo.uv = [];
				let i = 0;

				while ( geoNode.LayerElementUV[ i ] ) {

					if ( geoNode.LayerElementUV[ i ].UV ) {

						geoInfo.uv.push( this.parseUVs( geoNode.LayerElementUV[ i ] ) );

					}

					i ++;

				}

			}

			geoInfo.weightTable = {};

			if ( skeleton !== null ) {

				geoInfo.skeleton = skeleton;
				skeleton.rawBones.forEach( function ( rawBone, i ) {

					// loop over the bone's vertex indices and weights
					rawBone.indices.forEach( function ( index, j ) {

						if ( geoInfo.weightTable[ index ] === undefined ) geoInfo.weightTable[ index ] = [];
						geoInfo.weightTable[ index ].push( {
							id: i,
							weight: rawBone.weights[ j ]
						} );

					} );

				} );

			}

			return geoInfo;

		}

		genBuffers( geoInfo ) {

			const buffers = {
				vertex: [],
				normal: [],
				colors: [],
				uvs: [],
				materialIndex: [],
				vertexWeights: [],
				weightsIndices: []
			};
			let polygonIndex = 0;
			let faceLength = 0;
			let displayedWeightsWarning = false; // these will hold data for a single face

			let facePositionIndexes = [];
			let faceNormals = [];
			let faceColors = [];
			let faceUVs = [];
			let faceWeights = [];
			let faceWeightIndices = [];
			const scope = this;
			geoInfo.vertexIndices.forEach( function ( vertexIndex, polygonVertexIndex ) {

				let materialIndex;
				let endOfFace = false; // Face index and vertex index arrays are combined in a single array
				// A cube with quad faces looks like this:
				// PolygonVertexIndex: *24 {
				//  a: 0, 1, 3, -3, 2, 3, 5, -5, 4, 5, 7, -7, 6, 7, 1, -1, 1, 7, 5, -4, 6, 0, 2, -5
				//  }
				// Negative numbers mark the end of a face - first face here is 0, 1, 3, -3
				// to find index of last vertex bit shift the index: ^ - 1

				if ( vertexIndex < 0 ) {

					vertexIndex = vertexIndex ^ - 1; // equivalent to ( x * -1 ) - 1

					endOfFace = true;

				}

				let weightIndices = [];
				let weights = [];
				facePositionIndexes.push( vertexIndex * 3, vertexIndex * 3 + 1, vertexIndex * 3 + 2 );

				if ( geoInfo.color ) {

					const data = getData( polygonVertexIndex, polygonIndex, vertexIndex, geoInfo.color );
					faceColors.push( data[ 0 ], data[ 1 ], data[ 2 ] );

				}

				if ( geoInfo.skeleton ) {

					if ( geoInfo.weightTable[ vertexIndex ] !== undefined ) {

						geoInfo.weightTable[ vertexIndex ].forEach( function ( wt ) {

							weights.push( wt.weight );
							weightIndices.push( wt.id );

						} );

					}

					if ( weights.length > 4 ) {

						if ( ! displayedWeightsWarning ) {

							console.warn( 'THREE.FBXLoader: Vertex has more than 4 skinning weights assigned to vertex. Deleting additional weights.' );
							displayedWeightsWarning = true;

						}

						const wIndex = [ 0, 0, 0, 0 ];
						const Weight = [ 0, 0, 0, 0 ];
						weights.forEach( function ( weight, weightIndex ) {

							let currentWeight = weight;
							let currentIndex = weightIndices[ weightIndex ];
							Weight.forEach( function ( comparedWeight, comparedWeightIndex, comparedWeightArray ) {

								if ( currentWeight > comparedWeight ) {

									comparedWeightArray[ comparedWeightIndex ] = currentWeight;
									currentWeight = comparedWeight;
									const tmp = wIndex[ comparedWeightIndex ];
									wIndex[ comparedWeightIndex ] = currentIndex;
									currentIndex = tmp;

								}

							} );

						} );
						weightIndices = wIndex;
						weights = Weight;

					} // if the weight array is shorter than 4 pad with 0s


					while ( weights.length < 4 ) {

						weights.push( 0 );
						weightIndices.push( 0 );

					}

					for ( let i = 0; i < 4; ++ i ) {

						faceWeights.push( weights[ i ] );
						faceWeightIndices.push( weightIndices[ i ] );

					}

				}

				if ( geoInfo.normal ) {

					const data = getData( polygonVertexIndex, polygonIndex, vertexIndex, geoInfo.normal );
					faceNormals.push( data[ 0 ], data[ 1 ], data[ 2 ] );

				}

				if ( geoInfo.material && geoInfo.material.mappingType !== 'AllSame' ) {

					materialIndex = getData( polygonVertexIndex, polygonIndex, vertexIndex, geoInfo.material )[ 0 ];

				}

				if ( geoInfo.uv ) {

					geoInfo.uv.forEach( function ( uv, i ) {

						const data = getData( polygonVertexIndex, polygonIndex, vertexIndex, uv );

						if ( faceUVs[ i ] === undefined ) {

							faceUVs[ i ] = [];

						}

						faceUVs[ i ].push( data[ 0 ] );
						faceUVs[ i ].push( data[ 1 ] );

					} );

				}

				faceLength ++;

				if ( endOfFace ) {

					scope.genFace( buffers, geoInfo, facePositionIndexes, materialIndex, faceNormals, faceColors, faceUVs, faceWeights, faceWeightIndices, faceLength );
					polygonIndex ++;
					faceLength = 0; // reset arrays for the next face

					facePositionIndexes = [];
					faceNormals = [];
					faceColors = [];
					faceUVs = [];
					faceWeights = [];
					faceWeightIndices = [];

				}

			} );
			return buffers;

		} // Generate data for a single face in a geometry. If the face is a quad then split it into 2 tris


		genFace( buffers, geoInfo, facePositionIndexes, materialIndex, faceNormals, faceColors, faceUVs, faceWeights, faceWeightIndices, faceLength ) {

			for ( let i = 2; i < faceLength; i ++ ) {

				buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ 0 ] ] );
				buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ 1 ] ] );
				buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ 2 ] ] );
				buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ ( i - 1 ) * 3 ] ] );
				buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ ( i - 1 ) * 3 + 1 ] ] );
				buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ ( i - 1 ) * 3 + 2 ] ] );
				buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ i * 3 ] ] );
				buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ i * 3 + 1 ] ] );
				buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ i * 3 + 2 ] ] );

				if ( geoInfo.skeleton ) {

					buffers.vertexWeights.push( faceWeights[ 0 ] );
					buffers.vertexWeights.push( faceWeights[ 1 ] );
					buffers.vertexWeights.push( faceWeights[ 2 ] );
					buffers.vertexWeights.push( faceWeights[ 3 ] );
					buffers.vertexWeights.push( faceWeights[ ( i - 1 ) * 4 ] );
					buffers.vertexWeights.push( faceWeights[ ( i - 1 ) * 4 + 1 ] );
					buffers.vertexWeights.push( faceWeights[ ( i - 1 ) * 4 + 2 ] );
					buffers.vertexWeights.push( faceWeights[ ( i - 1 ) * 4 + 3 ] );
					buffers.vertexWeights.push( faceWeights[ i * 4 ] );
					buffers.vertexWeights.push( faceWeights[ i * 4 + 1 ] );
					buffers.vertexWeights.push( faceWeights[ i * 4 + 2 ] );
					buffers.vertexWeights.push( faceWeights[ i * 4 + 3 ] );
					buffers.weightsIndices.push( faceWeightIndices[ 0 ] );
					buffers.weightsIndices.push( faceWeightIndices[ 1 ] );
					buffers.weightsIndices.push( faceWeightIndices[ 2 ] );
					buffers.weightsIndices.push( faceWeightIndices[ 3 ] );
					buffers.weightsIndices.push( faceWeightIndices[ ( i - 1 ) * 4 ] );
					buffers.weightsIndices.push( faceWeightIndices[ ( i - 1 ) * 4 + 1 ] );
					buffers.weightsIndices.push( faceWeightIndices[ ( i - 1 ) * 4 + 2 ] );
					buffers.weightsIndices.push( faceWeightIndices[ ( i - 1 ) * 4 + 3 ] );
					buffers.weightsIndices.push( faceWeightIndices[ i * 4 ] );
					buffers.weightsIndices.push( faceWeightIndices[ i * 4 + 1 ] );
					buffers.weightsIndices.push( faceWeightIndices[ i * 4 + 2 ] );
					buffers.weightsIndices.push( faceWeightIndices[ i * 4 + 3 ] );

				}

				if ( geoInfo.color ) {

					buffers.colors.push( faceColors[ 0 ] );
					buffers.colors.push( faceColors[ 1 ] );
					buffers.colors.push( faceColors[ 2 ] );
					buffers.colors.push( faceColors[ ( i - 1 ) * 3 ] );
					buffers.colors.push( faceColors[ ( i - 1 ) * 3 + 1 ] );
					buffers.colors.push( faceColors[ ( i - 1 ) * 3 + 2 ] );
					buffers.colors.push( faceColors[ i * 3 ] );
					buffers.colors.push( faceColors[ i * 3 + 1 ] );
					buffers.colors.push( faceColors[ i * 3 + 2 ] );

				}

				if ( geoInfo.material && geoInfo.material.mappingType !== 'AllSame' ) {

					buffers.materialIndex.push( materialIndex );
					buffers.materialIndex.push( materialIndex );
					buffers.materialIndex.push( materialIndex );

				}

				if ( geoInfo.normal ) {

					buffers.normal.push( faceNormals[ 0 ] );
					buffers.normal.push( faceNormals[ 1 ] );
					buffers.normal.push( faceNormals[ 2 ] );
					buffers.normal.push( faceNormals[ ( i - 1 ) * 3 ] );
					buffers.normal.push( faceNormals[ ( i - 1 ) * 3 + 1 ] );
					buffers.normal.push( faceNormals[ ( i - 1 ) * 3 + 2 ] );
					buffers.normal.push( faceNormals[ i * 3 ] );
					buffers.normal.push( faceNormals[ i * 3 + 1 ] );
					buffers.normal.push( faceNormals[ i * 3 + 2 ] );

				}

				if ( geoInfo.uv ) {

					geoInfo.uv.forEach( function ( uv, j ) {

						if ( buffers.uvs[ j ] === undefined ) buffers.uvs[ j ] = [];
						buffers.uvs[ j ].push( faceUVs[ j ][ 0 ] );
						buffers.uvs[ j ].push( faceUVs[ j ][ 1 ] );
						buffers.uvs[ j ].push( faceUVs[ j ][ ( i - 1 ) * 2 ] );
						buffers.uvs[ j ].push( faceUVs[ j ][ ( i - 1 ) * 2 + 1 ] );
						buffers.uvs[ j ].push( faceUVs[ j ][ i * 2 ] );
						buffers.uvs[ j ].push( faceUVs[ j ][ i * 2 + 1 ] );

					} );

				}

			}

		}

		addMorphTargets( parentGeo, parentGeoNode, morphTargets, preTransform ) {

			if ( morphTargets.length === 0 ) return;
			parentGeo.morphTargetsRelative = true;
			parentGeo.morphAttributes.position = []; // parentGeo.morphAttributes.normal = []; // not implemented

			const scope = this;
			morphTargets.forEach( function ( morphTarget ) {

				morphTarget.rawTargets.forEach( function ( rawTarget ) {

					const morphGeoNode = fbxTree.Objects.Geometry[ rawTarget.geoID ];

					if ( morphGeoNode !== undefined ) {

						scope.genMorphGeometry( parentGeo, parentGeoNode, morphGeoNode, preTransform, rawTarget.name );

					}

				} );

			} );

		} // a morph geometry node is similar to a standard  node, and the node is also contained
		// in FBXTree.Objects.Geometry, however it can only have attributes for position, normal
		// and a special attribute Index defining which vertices of the original geometry are affected
		// Normal and position attributes only have data for the vertices that are affected by the morph


		genMorphGeometry( parentGeo, parentGeoNode, morphGeoNode, preTransform, name ) {

			const vertexIndices = parentGeoNode.PolygonVertexIndex !== undefined ? parentGeoNode.PolygonVertexIndex.a : [];
			const morphPositionsSparse = morphGeoNode.Vertices !== undefined ? morphGeoNode.Vertices.a : [];
			const indices = morphGeoNode.Indexes !== undefined ? morphGeoNode.Indexes.a : [];
			const length = parentGeo.attributes.position.count * 3;
			const morphPositions = new Float32Array( length );

			for ( let i = 0; i < indices.length; i ++ ) {

				const morphIndex = indices[ i ] * 3;
				morphPositions[ morphIndex ] = morphPositionsSparse[ i * 3 ];
				morphPositions[ morphIndex + 1 ] = morphPositionsSparse[ i * 3 + 1 ];
				morphPositions[ morphIndex + 2 ] = morphPositionsSparse[ i * 3 + 2 ];

			} // TODO: add morph normal support


			const morphGeoInfo = {
				vertexIndices: vertexIndices,
				vertexPositions: morphPositions
			};
			const morphBuffers = this.genBuffers( morphGeoInfo );
			const positionAttribute = new THREE.Float32BufferAttribute( morphBuffers.vertex, 3 );
			positionAttribute.name = name || morphGeoNode.attrName;
			positionAttribute.applyMatrix4( preTransform );
			parentGeo.morphAttributes.position.push( positionAttribute );

		} // Parse normal from FBXTree.Objects.Geometry.LayerElementNormal if it exists


		parseNormals( NormalNode ) {

			const mappingType = NormalNode.MappingInformationType;
			const referenceType = NormalNode.ReferenceInformationType;
			const buffer = NormalNode.Normals.a;
			let indexBuffer = [];

			if ( referenceType === 'IndexToDirect' ) {

				if ( 'NormalIndex' in NormalNode ) {

					indexBuffer = NormalNode.NormalIndex.a;

				} else if ( 'NormalsIndex' in NormalNode ) {

					indexBuffer = NormalNode.NormalsIndex.a;

				}

			}

			return {
				dataSize: 3,
				buffer: buffer,
				indices: indexBuffer,
				mappingType: mappingType,
				referenceType: referenceType
			};

		} // Parse UVs from FBXTree.Objects.Geometry.LayerElementUV if it exists


		parseUVs( UVNode ) {

			const mappingType = UVNode.MappingInformationType;
			const referenceType = UVNode.ReferenceInformationType;
			const buffer = UVNode.UV.a;
			let indexBuffer = [];

			if ( referenceType === 'IndexToDirect' ) {

				indexBuffer = UVNode.UVIndex.a;

			}

			return {
				dataSize: 2,
				buffer: buffer,
				indices: indexBuffer,
				mappingType: mappingType,
				referenceType: referenceType
			};

		} // Parse Vertex Colors from FBXTree.Objects.Geometry.LayerElementColor if it exists


		parseVertexColors( ColorNode ) {

			const mappingType = ColorNode.MappingInformationType;
			const referenceType = ColorNode.ReferenceInformationType;
			const buffer = ColorNode.Colors.a;
			let indexBuffer = [];

			if ( referenceType === 'IndexToDirect' ) {

				indexBuffer = ColorNode.ColorIndex.a;

			}

			return {
				dataSize: 4,
				buffer: buffer,
				indices: indexBuffer,
				mappingType: mappingType,
				referenceType: referenceType
			};

		} // Parse mapping and material data in FBXTree.Objects.Geometry.LayerElementMaterial if it exists


		parseMaterialIndices( MaterialNode ) {

			const mappingType = MaterialNode.MappingInformationType;
			const referenceType = MaterialNode.ReferenceInformationType;

			if ( mappingType === 'NoMappingInformation' ) {

				return {
					dataSize: 1,
					buffer: [ 0 ],
					indices: [ 0 ],
					mappingType: 'AllSame',
					referenceType: referenceType
				};

			}

			const materialIndexBuffer = MaterialNode.Materials.a; // Since materials are stored as indices, there's a bit of a mismatch between FBX and what
			// we expect.So we create an intermediate buffer that points to the index in the buffer,
			// for conforming with the other functions we've written for other data.

			const materialIndices = [];

			for ( let i = 0; i < materialIndexBuffer.length; ++ i ) {

				materialIndices.push( i );

			}

			return {
				dataSize: 1,
				buffer: materialIndexBuffer,
				indices: materialIndices,
				mappingType: mappingType,
				referenceType: referenceType
			};

		} // Generate a NurbGeometry from a node in FBXTree.Objects.Geometry


		parseNurbsGeometry( geoNode ) {

			if ( THREE.NURBSCurve === undefined ) {

				console.error( 'THREE.FBXLoader: The loader relies on THREE.NURBSCurve for any nurbs present in the model. Nurbs will show up as empty geometry.' );
				return new THREE.BufferGeometry();

			}

			const order = parseInt( geoNode.Order );

			if ( isNaN( order ) ) {

				console.error( 'THREE.FBXLoader: Invalid Order %s given for geometry ID: %s', geoNode.Order, geoNode.id );
				return new THREE.BufferGeometry();

			}

			const degree = order - 1;
			const knots = geoNode.KnotVector.a;
			const controlPoints = [];
			const pointsValues = geoNode.Points.a;

			for ( let i = 0, l = pointsValues.length; i < l; i += 4 ) {

				controlPoints.push( new THREE.Vector4().fromArray( pointsValues, i ) );

			}

			let startKnot, endKnot;

			if ( geoNode.Form === 'Closed' ) {

				controlPoints.push( controlPoints[ 0 ] );

			} else if ( geoNode.Form === 'Periodic' ) {

				startKnot = degree;
				endKnot = knots.length - 1 - startKnot;

				for ( let i = 0; i < degree; ++ i ) {

					controlPoints.push( controlPoints[ i ] );

				}

			}

			const curve = new THREE.NURBSCurve( degree, knots, controlPoints, startKnot, endKnot );
			const vertices = curve.getPoints( controlPoints.length * 7 );
			const positions = new Float32Array( vertices.length * 3 );
			vertices.forEach( function ( vertex, i ) {

				vertex.toArray( positions, i * 3 );

			} );
			const geometry = new THREE.BufferGeometry();
			geometry.setAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
			return geometry;

		}

	} // parse animation data from FBXTree


	class AnimationParser {

		// take raw animation clips and turn them into three.js animation clips
		parse() {

			const animationClips = [];
			const rawClips = this.parseClips();

			if ( rawClips !== undefined ) {

				for ( const key in rawClips ) {

					const rawClip = rawClips[ key ];
					const clip = this.addClip( rawClip );
					animationClips.push( clip );

				}

			}

			return animationClips;

		}

		parseClips() {

			// since the actual transformation data is stored in FBXTree.Objects.AnimationCurve,
			// if this is undefined we can safely assume there are no animations
			if ( fbxTree.Objects.AnimationCurve === undefined ) return undefined;
			const curveNodesMap = this.parseAnimationCurveNodes();
			this.parseAnimationCurves( curveNodesMap );
			const layersMap = this.parseAnimationLayers( curveNodesMap );
			const rawClips = this.parseAnimStacks( layersMap );
			return rawClips;

		} // parse nodes in FBXTree.Objects.AnimationCurveNode
		// each AnimationCurveNode holds data for an animation transform for a model (e.g. left arm rotation )
		// and is referenced by an AnimationLayer


		parseAnimationCurveNodes() {

			const rawCurveNodes = fbxTree.Objects.AnimationCurveNode;
			const curveNodesMap = new Map();

			for ( const nodeID in rawCurveNodes ) {

				const rawCurveNode = rawCurveNodes[ nodeID ];

				if ( rawCurveNode.attrName.match( /S|R|T|DeformPercent/ ) !== null ) {

					const curveNode = {
						id: rawCurveNode.id,
						attr: rawCurveNode.attrName,
						curves: {}
					};
					curveNodesMap.set( curveNode.id, curveNode );

				}

			}

			return curveNodesMap;

		} // parse nodes in FBXTree.Objects.AnimationCurve and connect them up to
		// previously parsed AnimationCurveNodes. Each AnimationCurve holds data for a single animated
		// axis ( e.g. times and values of x rotation)


		parseAnimationCurves( curveNodesMap ) {

			const rawCurves = fbxTree.Objects.AnimationCurve; // TODO: Many values are identical up to roundoff error, but won't be optimised
			// e.g. position times: [0, 0.4, 0. 8]
			// position values: [7.23538335023477e-7, 93.67518615722656, -0.9982695579528809, 7.23538335023477e-7, 93.67518615722656, -0.9982695579528809, 7.235384487103147e-7, 93.67520904541016, -0.9982695579528809]
			// clearly, this should be optimised to
			// times: [0], positions [7.23538335023477e-7, 93.67518615722656, -0.9982695579528809]
			// this shows up in nearly every FBX file, and generally time array is length > 100

			for ( const nodeID in rawCurves ) {

				const animationCurve = {
					id: rawCurves[ nodeID ].id,
					times: rawCurves[ nodeID ].KeyTime.a.map( convertFBXTimeToSeconds ),
					values: rawCurves[ nodeID ].KeyValueFloat.a
				};
				const relationships = connections.get( animationCurve.id );

				if ( relationships !== undefined ) {

					const animationCurveID = relationships.parents[ 0 ].ID;
					const animationCurveRelationship = relationships.parents[ 0 ].relationship;

					if ( animationCurveRelationship.match( /X/ ) ) {

						curveNodesMap.get( animationCurveID ).curves[ 'x' ] = animationCurve;

					} else if ( animationCurveRelationship.match( /Y/ ) ) {

						curveNodesMap.get( animationCurveID ).curves[ 'y' ] = animationCurve;

					} else if ( animationCurveRelationship.match( /Z/ ) ) {

						curveNodesMap.get( animationCurveID ).curves[ 'z' ] = animationCurve;

					} else if ( animationCurveRelationship.match( /d|DeformPercent/ ) && curveNodesMap.has( animationCurveID ) ) {

						curveNodesMap.get( animationCurveID ).curves[ 'morph' ] = animationCurve;

					}

				}

			}

		} // parse nodes in FBXTree.Objects.AnimationLayer. Each layers holds references
		// to various AnimationCurveNodes and is referenced by an AnimationStack node
		// note: theoretically a stack can have multiple layers, however in practice there always seems to be one per stack


		parseAnimationLayers( curveNodesMap ) {

			const rawLayers = fbxTree.Objects.AnimationLayer;
			const layersMap = new Map();

			for ( const nodeID in rawLayers ) {

				const layerCurveNodes = [];
				const connection = connections.get( parseInt( nodeID ) );

				if ( connection !== undefined ) {

					// all the animationCurveNodes used in the layer
					const children = connection.children;
					children.forEach( function ( child, i ) {

						if ( curveNodesMap.has( child.ID ) ) {

							const curveNode = curveNodesMap.get( child.ID ); // check that the curves are defined for at least one axis, otherwise ignore the curveNode

							if ( curveNode.curves.x !== undefined || curveNode.curves.y !== undefined || curveNode.curves.z !== undefined ) {

								if ( layerCurveNodes[ i ] === undefined ) {

									const modelID = connections.get( child.ID ).parents.filter( function ( parent ) {

										return parent.relationship !== undefined;

									} )[ 0 ].ID;

									if ( modelID !== undefined ) {

										const rawModel = fbxTree.Objects.Model[ modelID.toString() ];

										if ( rawModel === undefined ) {

											console.warn( 'THREE.FBXLoader: Encountered a unused curve.', child );
											return;

										}

										const node = {
											modelName: rawModel.attrName ? THREE.PropertyBinding.sanitizeNodeName( rawModel.attrName ) : '',
											ID: rawModel.id,
											initialPosition: [ 0, 0, 0 ],
											initialRotation: [ 0, 0, 0 ],
											initialScale: [ 1, 1, 1 ]
										};
										sceneGraph.traverse( function ( child ) {

											if ( child.ID === rawModel.id ) {

												node.transform = child.matrix;
												if ( child.userData.transformData ) node.eulerOrder = child.userData.transformData.eulerOrder;

											}

										} );
										if ( ! node.transform ) node.transform = new THREE.Matrix4(); // if the animated model is pre rotated, we'll have to apply the pre rotations to every
										// animation value as well

										if ( 'PreRotation' in rawModel ) node.preRotation = rawModel.PreRotation.value;
										if ( 'PostRotation' in rawModel ) node.postRotation = rawModel.PostRotation.value;
										layerCurveNodes[ i ] = node;

									}

								}

								if ( layerCurveNodes[ i ] ) layerCurveNodes[ i ][ curveNode.attr ] = curveNode;

							} else if ( curveNode.curves.morph !== undefined ) {

								if ( layerCurveNodes[ i ] === undefined ) {

									const deformerID = connections.get( child.ID ).parents.filter( function ( parent ) {

										return parent.relationship !== undefined;

									} )[ 0 ].ID;
									const morpherID = connections.get( deformerID ).parents[ 0 ].ID;
									const geoID = connections.get( morpherID ).parents[ 0 ].ID; // assuming geometry is not used in more than one model

									const modelID = connections.get( geoID ).parents[ 0 ].ID;
									const rawModel = fbxTree.Objects.Model[ modelID ];
									const node = {
										modelName: rawModel.attrName ? THREE.PropertyBinding.sanitizeNodeName( rawModel.attrName ) : '',
										morphName: fbxTree.Objects.Deformer[ deformerID ].attrName
									};
									layerCurveNodes[ i ] = node;

								}

								layerCurveNodes[ i ][ curveNode.attr ] = curveNode;

							}

						}

					} );
					layersMap.set( parseInt( nodeID ), layerCurveNodes );

				}

			}

			return layersMap;

		} // parse nodes in FBXTree.Objects.AnimationStack. These are the top level node in the animation
		// hierarchy. Each Stack node will be used to create a THREE.AnimationClip


		parseAnimStacks( layersMap ) {

			const rawStacks = fbxTree.Objects.AnimationStack; // connect the stacks (clips) up to the layers

			const rawClips = {};

			for ( const nodeID in rawStacks ) {

				const children = connections.get( parseInt( nodeID ) ).children;

				if ( children.length > 1 ) {

					// it seems like stacks will always be associated with a single layer. But just in case there are files
					// where there are multiple layers per stack, we'll display a warning
					console.warn( 'THREE.FBXLoader: Encountered an animation stack with multiple layers, this is currently not supported. Ignoring subsequent layers.' );

				}

				const layer = layersMap.get( children[ 0 ].ID );
				rawClips[ nodeID ] = {
					name: rawStacks[ nodeID ].attrName,
					layer: layer
				};

			}

			return rawClips;

		}

		addClip( rawClip ) {

			let tracks = [];
			const scope = this;
			rawClip.layer.forEach( function ( rawTracks ) {

				tracks = tracks.concat( scope.generateTracks( rawTracks ) );

			} );
			return new THREE.AnimationClip( rawClip.name, - 1, tracks );

		}

		generateTracks( rawTracks ) {

			const tracks = [];
			let initialPosition = new THREE.Vector3();
			let initialRotation = new THREE.Quaternion();
			let initialScale = new THREE.Vector3();
			if ( rawTracks.transform ) rawTracks.transform.decompose( initialPosition, initialRotation, initialScale );
			initialPosition = initialPosition.toArray();
			initialRotation = new THREE.Euler().setFromQuaternion( initialRotation, rawTracks.eulerOrder ).toArray();
			initialScale = initialScale.toArray();

			if ( rawTracks.T !== undefined && Object.keys( rawTracks.T.curves ).length > 0 ) {

				const positionTrack = this.generateVectorTrack( rawTracks.modelName, rawTracks.T.curves, initialPosition, 'position' );
				if ( positionTrack !== undefined ) tracks.push( positionTrack );

			}

			if ( rawTracks.R !== undefined && Object.keys( rawTracks.R.curves ).length > 0 ) {

				const rotationTrack = this.generateRotationTrack( rawTracks.modelName, rawTracks.R.curves, initialRotation, rawTracks.preRotation, rawTracks.postRotation, rawTracks.eulerOrder );
				if ( rotationTrack !== undefined ) tracks.push( rotationTrack );

			}

			if ( rawTracks.S !== undefined && Object.keys( rawTracks.S.curves ).length > 0 ) {

				const scaleTrack = this.generateVectorTrack( rawTracks.modelName, rawTracks.S.curves, initialScale, 'scale' );
				if ( scaleTrack !== undefined ) tracks.push( scaleTrack );

			}

			if ( rawTracks.DeformPercent !== undefined ) {

				const morphTrack = this.generateMorphTrack( rawTracks );
				if ( morphTrack !== undefined ) tracks.push( morphTrack );

			}

			return tracks;

		}

		generateVectorTrack( modelName, curves, initialValue, type ) {

			const times = this.getTimesForAllAxes( curves );
			const values = this.getKeyframeTrackValues( times, curves, initialValue );
			return new THREE.VectorKeyframeTrack( modelName + '.' + type, times, values );

		}

		generateRotationTrack( modelName, curves, initialValue, preRotation, postRotation, eulerOrder ) {

			if ( curves.x !== undefined ) {

				this.interpolateRotations( curves.x );
				curves.x.values = curves.x.values.map( THREE.MathUtils.degToRad );

			}

			if ( curves.y !== undefined ) {

				this.interpolateRotations( curves.y );
				curves.y.values = curves.y.values.map( THREE.MathUtils.degToRad );

			}

			if ( curves.z !== undefined ) {

				this.interpolateRotations( curves.z );
				curves.z.values = curves.z.values.map( THREE.MathUtils.degToRad );

			}

			const times = this.getTimesForAllAxes( curves );
			const values = this.getKeyframeTrackValues( times, curves, initialValue );

			if ( preRotation !== undefined ) {

				preRotation = preRotation.map( THREE.MathUtils.degToRad );
				preRotation.push( eulerOrder );
				preRotation = new THREE.Euler().fromArray( preRotation );
				preRotation = new THREE.Quaternion().setFromEuler( preRotation );

			}

			if ( postRotation !== undefined ) {

				postRotation = postRotation.map( THREE.MathUtils.degToRad );
				postRotation.push( eulerOrder );
				postRotation = new THREE.Euler().fromArray( postRotation );
				postRotation = new THREE.Quaternion().setFromEuler( postRotation ).invert();

			}

			const quaternion = new THREE.Quaternion();
			const euler = new THREE.Euler();
			const quaternionValues = [];

			for ( let i = 0; i < values.length; i += 3 ) {

				euler.set( values[ i ], values[ i + 1 ], values[ i + 2 ], eulerOrder );
				quaternion.setFromEuler( euler );
				if ( preRotation !== undefined ) quaternion.premultiply( preRotation );
				if ( postRotation !== undefined ) quaternion.multiply( postRotation );
				quaternion.toArray( quaternionValues, i / 3 * 4 );

			}

			return new THREE.QuaternionKeyframeTrack( modelName + '.quaternion', times, quaternionValues );

		}

		generateMorphTrack( rawTracks ) {

			const curves = rawTracks.DeformPercent.curves.morph;
			const values = curves.values.map( function ( val ) {

				return val / 100;

			} );
			const morphNum = sceneGraph.getObjectByName( rawTracks.modelName ).morphTargetDictionary[ rawTracks.morphName ];
			return new THREE.NumberKeyframeTrack( rawTracks.modelName + '.morphTargetInfluences[' + morphNum + ']', curves.times, values );

		} // For all animated objects, times are defined separately for each axis
		// Here we'll combine the times into one sorted array without duplicates


		getTimesForAllAxes( curves ) {

			let times = []; // first join together the times for each axis, if defined

			if ( curves.x !== undefined ) times = times.concat( curves.x.times );
			if ( curves.y !== undefined ) times = times.concat( curves.y.times );
			if ( curves.z !== undefined ) times = times.concat( curves.z.times ); // then sort them

			times = times.sort( function ( a, b ) {

				return a - b;

			} ); // and remove duplicates

			if ( times.length > 1 ) {

				let targetIndex = 1;
				let lastValue = times[ 0 ];

				for ( let i = 1; i < times.length; i ++ ) {

					const currentValue = times[ i ];

					if ( currentValue !== lastValue ) {

						times[ targetIndex ] = currentValue;
						lastValue = currentValue;
						targetIndex ++;

					}

				}

				times = times.slice( 0, targetIndex );

			}

			return times;

		}

		getKeyframeTrackValues( times, curves, initialValue ) {

			const prevValue = initialValue;
			const values = [];
			let xIndex = - 1;
			let yIndex = - 1;
			let zIndex = - 1;
			times.forEach( function ( time ) {

				if ( curves.x ) xIndex = curves.x.times.indexOf( time );
				if ( curves.y ) yIndex = curves.y.times.indexOf( time );
				if ( curves.z ) zIndex = curves.z.times.indexOf( time ); // if there is an x value defined for this frame, use that

				if ( xIndex !== - 1 ) {

					const xValue = curves.x.values[ xIndex ];
					values.push( xValue );
					prevValue[ 0 ] = xValue;

				} else {

					// otherwise use the x value from the previous frame
					values.push( prevValue[ 0 ] );

				}

				if ( yIndex !== - 1 ) {

					const yValue = curves.y.values[ yIndex ];
					values.push( yValue );
					prevValue[ 1 ] = yValue;

				} else {

					values.push( prevValue[ 1 ] );

				}

				if ( zIndex !== - 1 ) {

					const zValue = curves.z.values[ zIndex ];
					values.push( zValue );
					prevValue[ 2 ] = zValue;

				} else {

					values.push( prevValue[ 2 ] );

				}

			} );
			return values;

		} // Rotations are defined as THREE.Euler angles which can have values  of any size
		// These will be converted to quaternions which don't support values greater than
		// PI, so we'll interpolate large rotations


		interpolateRotations( curve ) {

			for ( let i = 1; i < curve.values.length; i ++ ) {

				const initialValue = curve.values[ i - 1 ];
				const valuesSpan = curve.values[ i ] - initialValue;
				const absoluteSpan = Math.abs( valuesSpan );

				if ( absoluteSpan >= 180 ) {

					const numSubIntervals = absoluteSpan / 180;
					const step = valuesSpan / numSubIntervals;
					let nextValue = initialValue + step;
					const initialTime = curve.times[ i - 1 ];
					const timeSpan = curve.times[ i ] - initialTime;
					const interval = timeSpan / numSubIntervals;
					let nextTime = initialTime + interval;
					const interpolatedTimes = [];
					const interpolatedValues = [];

					while ( nextTime < curve.times[ i ] ) {

						interpolatedTimes.push( nextTime );
						nextTime += interval;
						interpolatedValues.push( nextValue );
						nextValue += step;

					}

					curve.times = inject( curve.times, i, interpolatedTimes );
					curve.values = inject( curve.values, i, interpolatedValues );

				}

			}

		}

	} // parse an FBX file in ASCII format


	class TextParser {

		getPrevNode() {

			return this.nodeStack[ this.currentIndent - 2 ];

		}

		getCurrentNode() {

			return this.nodeStack[ this.currentIndent - 1 ];

		}

		getCurrentProp() {

			return this.currentProp;

		}

		pushStack( node ) {

			this.nodeStack.push( node );
			this.currentIndent += 1;

		}

		popStack() {

			this.nodeStack.pop();
			this.currentIndent -= 1;

		}

		setCurrentProp( val, name ) {

			this.currentProp = val;
			this.currentPropName = name;

		}

		parse( text ) {

			this.currentIndent = 0;
			this.allNodes = new FBXTree();
			this.nodeStack = [];
			this.currentProp = [];
			this.currentPropName = '';
			const scope = this;
			const split = text.split( /[\r\n]+/ );
			split.forEach( function ( line, i ) {

				const matchComment = line.match( /^[\s\t]*;/ );
				const matchEmpty = line.match( /^[\s\t]*$/ );
				if ( matchComment || matchEmpty ) return;
				const matchBeginning = line.match( '^\\t{' + scope.currentIndent + '}(\\w+):(.*){', '' );
				const matchProperty = line.match( '^\\t{' + scope.currentIndent + '}(\\w+):[\\s\\t\\r\\n](.*)' );
				const matchEnd = line.match( '^\\t{' + ( scope.currentIndent - 1 ) + '}}' );

				if ( matchBeginning ) {

					scope.parseNodeBegin( line, matchBeginning );

				} else if ( matchProperty ) {

					scope.parseNodeProperty( line, matchProperty, split[ ++ i ] );

				} else if ( matchEnd ) {

					scope.popStack();

				} else if ( line.match( /^[^\s\t}]/ ) ) {

					// large arrays are split over multiple lines terminated with a ',' character
					// if this is encountered the line needs to be joined to the previous line
					scope.parseNodePropertyContinued( line );

				}

			} );
			return this.allNodes;

		}

		parseNodeBegin( line, property ) {

			const nodeName = property[ 1 ].trim().replace( /^"/, '' ).replace( /"$/, '' );
			const nodeAttrs = property[ 2 ].split( ',' ).map( function ( attr ) {

				return attr.trim().replace( /^"/, '' ).replace( /"$/, '' );

			} );
			const node = {
				name: nodeName
			};
			const attrs = this.parseNodeAttr( nodeAttrs );
			const currentNode = this.getCurrentNode(); // a top node

			if ( this.currentIndent === 0 ) {

				this.allNodes.add( nodeName, node );

			} else {

				// a subnode
				// if the subnode already exists, append it
				if ( nodeName in currentNode ) {

					// special case Pose needs PoseNodes as an array
					if ( nodeName === 'PoseNode' ) {

						currentNode.PoseNode.push( node );

					} else if ( currentNode[ nodeName ].id !== undefined ) {

						currentNode[ nodeName ] = {};
						currentNode[ nodeName ][ currentNode[ nodeName ].id ] = currentNode[ nodeName ];

					}

					if ( attrs.id !== '' ) currentNode[ nodeName ][ attrs.id ] = node;

				} else if ( typeof attrs.id === 'number' ) {

					currentNode[ nodeName ] = {};
					currentNode[ nodeName ][ attrs.id ] = node;

				} else if ( nodeName !== 'Properties70' ) {

					if ( nodeName === 'PoseNode' ) currentNode[ nodeName ] = [ node ]; else currentNode[ nodeName ] = node;

				}

			}

			if ( typeof attrs.id === 'number' ) node.id = attrs.id;
			if ( attrs.name !== '' ) node.attrName = attrs.name;
			if ( attrs.type !== '' ) node.attrType = attrs.type;
			this.pushStack( node );

		}

		parseNodeAttr( attrs ) {

			let id = attrs[ 0 ];

			if ( attrs[ 0 ] !== '' ) {

				id = parseInt( attrs[ 0 ] );

				if ( isNaN( id ) ) {

					id = attrs[ 0 ];

				}

			}

			let name = '',
				type = '';

			if ( attrs.length > 1 ) {

				name = attrs[ 1 ].replace( /^(\w+)::/, '' );
				type = attrs[ 2 ];

			}

			return {
				id: id,
				name: name,
				type: type
			};

		}

		parseNodeProperty( line, property, contentLine ) {

			let propName = property[ 1 ].replace( /^"/, '' ).replace( /"$/, '' ).trim();
			let propValue = property[ 2 ].replace( /^"/, '' ).replace( /"$/, '' ).trim(); // for special case: base64 image data follows "Content: ," line
			//	Content: ,
			//	 "/9j/4RDaRXhpZgAATU0A..."

			if ( propName === 'Content' && propValue === ',' ) {

				propValue = contentLine.replace( /"/g, '' ).replace( /,$/, '' ).trim();

			}

			const currentNode = this.getCurrentNode();
			const parentName = currentNode.name;

			if ( parentName === 'Properties70' ) {

				this.parseNodeSpecialProperty( line, propName, propValue );
				return;

			} // Connections


			if ( propName === 'C' ) {

				const connProps = propValue.split( ',' ).slice( 1 );
				const from = parseInt( connProps[ 0 ] );
				const to = parseInt( connProps[ 1 ] );
				let rest = propValue.split( ',' ).slice( 3 );
				rest = rest.map( function ( elem ) {

					return elem.trim().replace( /^"/, '' );

				} );
				propName = 'connections';
				propValue = [ from, to ];
				append( propValue, rest );

				if ( currentNode[ propName ] === undefined ) {

					currentNode[ propName ] = [];

				}

			} // Node


			if ( propName === 'Node' ) currentNode.id = propValue; // connections

			if ( propName in currentNode && Array.isArray( currentNode[ propName ] ) ) {

				currentNode[ propName ].push( propValue );

			} else {

				if ( propName !== 'a' ) currentNode[ propName ] = propValue; else currentNode.a = propValue;

			}

			this.setCurrentProp( currentNode, propName ); // convert string to array, unless it ends in ',' in which case more will be added to it

			if ( propName === 'a' && propValue.slice( - 1 ) !== ',' ) {

				currentNode.a = parseNumberArray( propValue );

			}

		}

		parseNodePropertyContinued( line ) {

			const currentNode = this.getCurrentNode();
			currentNode.a += line; // if the line doesn't end in ',' we have reached the end of the property value
			// so convert the string to an array

			if ( line.slice( - 1 ) !== ',' ) {

				currentNode.a = parseNumberArray( currentNode.a );

			}

		} // parse "Property70"


		parseNodeSpecialProperty( line, propName, propValue ) {

			// split this
			// P: "Lcl Scaling", "Lcl Scaling", "", "A",1,1,1
			// into array like below
			// ["Lcl Scaling", "Lcl Scaling", "", "A", "1,1,1" ]
			const props = propValue.split( '",' ).map( function ( prop ) {

				return prop.trim().replace( /^\"/, '' ).replace( /\s/, '_' );

			} );
			const innerPropName = props[ 0 ];
			const innerPropType1 = props[ 1 ];
			const innerPropType2 = props[ 2 ];
			const innerPropFlag = props[ 3 ];
			let innerPropValue = props[ 4 ]; // cast values where needed, otherwise leave as strings

			switch ( innerPropType1 ) {

				case 'int':
				case 'enum':
				case 'bool':
				case 'ULongLong':
				case 'double':
				case 'Number':
				case 'FieldOfView':
					innerPropValue = parseFloat( innerPropValue );
					break;

				case 'Color':
				case 'ColorRGB':
				case 'Vector3D':
				case 'Lcl_Translation':
				case 'Lcl_Rotation':
				case 'Lcl_Scaling':
					innerPropValue = parseNumberArray( innerPropValue );
					break;

			} // CAUTION: these props must append to parent's parent


			this.getPrevNode()[ innerPropName ] = {
				'type': innerPropType1,
				'type2': innerPropType2,
				'flag': innerPropFlag,
				'value': innerPropValue
			};
			this.setCurrentProp( this.getPrevNode(), innerPropName );

		}

	} // Parse an FBX file in Binary format


	class BinaryParser {

		parse( buffer ) {

			const reader = new BinaryReader( buffer );
			reader.skip( 23 ); // skip magic 23 bytes

			const version = reader.getUint32();

			if ( version < 6400 ) {

				throw new Error( 'THREE.FBXLoader: FBX version not supported, FileVersion: ' + version );

			}

			const allNodes = new FBXTree();

			while ( ! this.endOfContent( reader ) ) {

				const node = this.parseNode( reader, version );
				if ( node !== null ) allNodes.add( node.name, node );

			}

			return allNodes;

		} // Check if reader has reached the end of content.


		endOfContent( reader ) {

			// footer size: 160bytes + 16-byte alignment padding
			// - 16bytes: magic
			// - padding til 16-byte alignment (at least 1byte?)
			//	(seems like some exporters embed fixed 15 or 16bytes?)
			// - 4bytes: magic
			// - 4bytes: version
			// - 120bytes: zero
			// - 16bytes: magic
			if ( reader.size() % 16 === 0 ) {

				return ( reader.getOffset() + 160 + 16 & ~ 0xf ) >= reader.size();

			} else {

				return reader.getOffset() + 160 + 16 >= reader.size();

			}

		} // recursively parse nodes until the end of the file is reached


		parseNode( reader, version ) {

			const node = {}; // The first three data sizes depends on version.

			const endOffset = version >= 7500 ? reader.getUint64() : reader.getUint32();
			const numProperties = version >= 7500 ? reader.getUint64() : reader.getUint32();
			version >= 7500 ? reader.getUint64() : reader.getUint32(); // the returned propertyListLen is not used

			const nameLen = reader.getUint8();
			const name = reader.getString( nameLen ); // Regards this node as NULL-record if endOffset is zero

			if ( endOffset === 0 ) return null;
			const propertyList = [];

			for ( let i = 0; i < numProperties; i ++ ) {

				propertyList.push( this.parseProperty( reader ) );

			} // Regards the first three elements in propertyList as id, attrName, and attrType


			const id = propertyList.length > 0 ? propertyList[ 0 ] : '';
			const attrName = propertyList.length > 1 ? propertyList[ 1 ] : '';
			const attrType = propertyList.length > 2 ? propertyList[ 2 ] : ''; // check if this node represents just a single property
			// like (name, 0) set or (name2, [0, 1, 2]) set of {name: 0, name2: [0, 1, 2]}

			node.singleProperty = numProperties === 1 && reader.getOffset() === endOffset ? true : false;

			while ( endOffset > reader.getOffset() ) {

				const subNode = this.parseNode( reader, version );
				if ( subNode !== null ) this.parseSubNode( name, node, subNode );

			}

			node.propertyList = propertyList; // raw property list used by parent

			if ( typeof id === 'number' ) node.id = id;
			if ( attrName !== '' ) node.attrName = attrName;
			if ( attrType !== '' ) node.attrType = attrType;
			if ( name !== '' ) node.name = name;
			return node;

		}

		parseSubNode( name, node, subNode ) {

			// special case: child node is single property
			if ( subNode.singleProperty === true ) {

				const value = subNode.propertyList[ 0 ];

				if ( Array.isArray( value ) ) {

					node[ subNode.name ] = subNode;
					subNode.a = value;

				} else {

					node[ subNode.name ] = value;

				}

			} else if ( name === 'Connections' && subNode.name === 'C' ) {

				const array = [];
				subNode.propertyList.forEach( function ( property, i ) {

					// first Connection is FBX type (OO, OP, etc.). We'll discard these
					if ( i !== 0 ) array.push( property );

				} );

				if ( node.connections === undefined ) {

					node.connections = [];

				}

				node.connections.push( array );

			} else if ( subNode.name === 'Properties70' ) {

				const keys = Object.keys( subNode );
				keys.forEach( function ( key ) {

					node[ key ] = subNode[ key ];

				} );

			} else if ( name === 'Properties70' && subNode.name === 'P' ) {

				let innerPropName = subNode.propertyList[ 0 ];
				let innerPropType1 = subNode.propertyList[ 1 ];
				const innerPropType2 = subNode.propertyList[ 2 ];
				const innerPropFlag = subNode.propertyList[ 3 ];
				let innerPropValue;
				if ( innerPropName.indexOf( 'Lcl ' ) === 0 ) innerPropName = innerPropName.replace( 'Lcl ', 'Lcl_' );
				if ( innerPropType1.indexOf( 'Lcl ' ) === 0 ) innerPropType1 = innerPropType1.replace( 'Lcl ', 'Lcl_' );

				if ( innerPropType1 === 'Color' || innerPropType1 === 'ColorRGB' || innerPropType1 === 'Vector' || innerPropType1 === 'Vector3D' || innerPropType1.indexOf( 'Lcl_' ) === 0 ) {

					innerPropValue = [ subNode.propertyList[ 4 ], subNode.propertyList[ 5 ], subNode.propertyList[ 6 ] ];

				} else {

					innerPropValue = subNode.propertyList[ 4 ];

				} // this will be copied to parent, see above


				node[ innerPropName ] = {
					'type': innerPropType1,
					'type2': innerPropType2,
					'flag': innerPropFlag,
					'value': innerPropValue
				};

			} else if ( node[ subNode.name ] === undefined ) {

				if ( typeof subNode.id === 'number' ) {

					node[ subNode.name ] = {};
					node[ subNode.name ][ subNode.id ] = subNode;

				} else {

					node[ subNode.name ] = subNode;

				}

			} else {

				if ( subNode.name === 'PoseNode' ) {

					if ( ! Array.isArray( node[ subNode.name ] ) ) {

						node[ subNode.name ] = [ node[ subNode.name ] ];

					}

					node[ subNode.name ].push( subNode );

				} else if ( node[ subNode.name ][ subNode.id ] === undefined ) {

					node[ subNode.name ][ subNode.id ] = subNode;

				}

			}

		}

		parseProperty( reader ) {

			const type = reader.getString( 1 );
			let length;

			switch ( type ) {

				case 'C':
					return reader.getBoolean();

				case 'D':
					return reader.getFloat64();

				case 'F':
					return reader.getFloat32();

				case 'I':
					return reader.getInt32();

				case 'L':
					return reader.getInt64();

				case 'R':
					length = reader.getUint32();
					return reader.getArrayBuffer( length );

				case 'S':
					length = reader.getUint32();
					return reader.getString( length );

				case 'Y':
					return reader.getInt16();

				case 'b':
				case 'c':
				case 'd':
				case 'f':
				case 'i':
				case 'l':
					const arrayLength = reader.getUint32();
					const encoding = reader.getUint32(); // 0: non-compressed, 1: compressed

					const compressedLength = reader.getUint32();

					if ( encoding === 0 ) {

						switch ( type ) {

							case 'b':
							case 'c':
								return reader.getBooleanArray( arrayLength );

							case 'd':
								return reader.getFloat64Array( arrayLength );

							case 'f':
								return reader.getFloat32Array( arrayLength );

							case 'i':
								return reader.getInt32Array( arrayLength );

							case 'l':
								return reader.getInt64Array( arrayLength );

						}

					}

					if ( typeof fflate === 'undefined' ) {

						console.error( 'THREE.FBXLoader: External library fflate.min.js required.' );

					}

					const data = fflate.unzlibSync( new Uint8Array( reader.getArrayBuffer( compressedLength ) ) ); // eslint-disable-line no-undef

					const reader2 = new BinaryReader( data.buffer );

					switch ( type ) {

						case 'b':
						case 'c':
							return reader2.getBooleanArray( arrayLength );

						case 'd':
							return reader2.getFloat64Array( arrayLength );

						case 'f':
							return reader2.getFloat32Array( arrayLength );

						case 'i':
							return reader2.getInt32Array( arrayLength );

						case 'l':
							return reader2.getInt64Array( arrayLength );

					}

				default:
					throw new Error( 'THREE.FBXLoader: Unknown property type ' + type );

			}

		}

	}

	class BinaryReader {

		constructor( buffer, littleEndian ) {

			this.dv = new DataView( buffer );
			this.offset = 0;
			this.littleEndian = littleEndian !== undefined ? littleEndian : true;

		}

		getOffset() {

			return this.offset;

		}

		size() {

			return this.dv.buffer.byteLength;

		}

		skip( length ) {

			this.offset += length;

		} // seems like true/false representation depends on exporter.
		// true: 1 or 'Y'(=0x59), false: 0 or 'T'(=0x54)
		// then sees LSB.


		getBoolean() {

			return ( this.getUint8() & 1 ) === 1;

		}

		getBooleanArray( size ) {

			const a = [];

			for ( let i = 0; i < size; i ++ ) {

				a.push( this.getBoolean() );

			}

			return a;

		}

		getUint8() {

			const value = this.dv.getUint8( this.offset );
			this.offset += 1;
			return value;

		}

		getInt16() {

			const value = this.dv.getInt16( this.offset, this.littleEndian );
			this.offset += 2;
			return value;

		}

		getInt32() {

			const value = this.dv.getInt32( this.offset, this.littleEndian );
			this.offset += 4;
			return value;

		}

		getInt32Array( size ) {

			const a = [];

			for ( let i = 0; i < size; i ++ ) {

				a.push( this.getInt32() );

			}

			return a;

		}

		getUint32() {

			const value = this.dv.getUint32( this.offset, this.littleEndian );
			this.offset += 4;
			return value;

		} // JavaScript doesn't support 64-bit integer so calculate this here
		// 1 << 32 will return 1 so using multiply operation instead here.
		// There's a possibility that this method returns wrong value if the value
		// is out of the range between Number.MAX_SAFE_INTEGER and Number.MIN_SAFE_INTEGER.
		// TODO: safely handle 64-bit integer


		getInt64() {

			let low, high;

			if ( this.littleEndian ) {

				low = this.getUint32();
				high = this.getUint32();

			} else {

				high = this.getUint32();
				low = this.getUint32();

			} // calculate negative value


			if ( high & 0x80000000 ) {

				high = ~ high & 0xFFFFFFFF;
				low = ~ low & 0xFFFFFFFF;
				if ( low === 0xFFFFFFFF ) high = high + 1 & 0xFFFFFFFF;
				low = low + 1 & 0xFFFFFFFF;
				return - ( high * 0x100000000 + low );

			}

			return high * 0x100000000 + low;

		}

		getInt64Array( size ) {

			const a = [];

			for ( let i = 0; i < size; i ++ ) {

				a.push( this.getInt64() );

			}

			return a;

		} // Note: see getInt64() comment


		getUint64() {

			let low, high;

			if ( this.littleEndian ) {

				low = this.getUint32();
				high = this.getUint32();

			} else {

				high = this.getUint32();
				low = this.getUint32();

			}

			return high * 0x100000000 + low;

		}

		getFloat32() {

			const value = this.dv.getFloat32( this.offset, this.littleEndian );
			this.offset += 4;
			return value;

		}

		getFloat32Array( size ) {

			const a = [];

			for ( let i = 0; i < size; i ++ ) {

				a.push( this.getFloat32() );

			}

			return a;

		}

		getFloat64() {

			const value = this.dv.getFloat64( this.offset, this.littleEndian );
			this.offset += 8;
			return value;

		}

		getFloat64Array( size ) {

			const a = [];

			for ( let i = 0; i < size; i ++ ) {

				a.push( this.getFloat64() );

			}

			return a;

		}

		getArrayBuffer( size ) {

			const value = this.dv.buffer.slice( this.offset, this.offset + size );
			this.offset += size;
			return value;

		}

		getString( size ) {

			// note: safari 9 doesn't support Uint8Array.indexOf; create intermediate array instead
			let a = [];

			for ( let i = 0; i < size; i ++ ) {

				a[ i ] = this.getUint8();

			}

			const nullByte = a.indexOf( 0 );
			if ( nullByte >= 0 ) a = a.slice( 0, nullByte );
			return THREE.LoaderUtils.decodeText( new Uint8Array( a ) );

		}

	} // FBXTree holds a representation of the FBX data, returned by the TextParser ( FBX ASCII format)
	// and BinaryParser( FBX Binary format)


	class FBXTree {

		add( key, val ) {

			this[ key ] = val;

		}

	} // ************** UTILITY FUNCTIONS **************


	function isFbxFormatBinary( buffer ) {

		const CORRECT = 'Kaydara\u0020FBX\u0020Binary\u0020\u0020\0';
		return buffer.byteLength >= CORRECT.length && CORRECT === convertArrayBufferToString( buffer, 0, CORRECT.length );

	}

	function isFbxFormatASCII( text ) {

		const CORRECT = [ 'K', 'a', 'y', 'd', 'a', 'r', 'a', '\\', 'F', 'B', 'X', '\\', 'B', 'i', 'n', 'a', 'r', 'y', '\\', '\\' ];
		let cursor = 0;

		function read( offset ) {

			const result = text[ offset - 1 ];
			text = text.slice( cursor + offset );
			cursor ++;
			return result;

		}

		for ( let i = 0; i < CORRECT.length; ++ i ) {

			const num = read( 1 );

			if ( num === CORRECT[ i ] ) {

				return false;

			}

		}

		return true;

	}

	function getFbxVersion( text ) {

		const versionRegExp = /FBXVersion: (\d+)/;
		const match = text.match( versionRegExp );

		if ( match ) {

			const version = parseInt( match[ 1 ] );
			return version;

		}

		throw new Error( 'THREE.FBXLoader: Cannot find the version number for the file given.' );

	} // Converts FBX ticks into real time seconds.


	function convertFBXTimeToSeconds( time ) {

		return time / 46186158000;

	}

	const dataArray = []; // extracts the data from the correct position in the FBX array based on indexing type

	function getData( polygonVertexIndex, polygonIndex, vertexIndex, infoObject ) {

		let index;

		switch ( infoObject.mappingType ) {

			case 'ByPolygonVertex':
				index = polygonVertexIndex;
				break;

			case 'ByPolygon':
				index = polygonIndex;
				break;

			case 'ByVertice':
				index = vertexIndex;
				break;

			case 'AllSame':
				index = infoObject.indices[ 0 ];
				break;

			default:
				console.warn( 'THREE.FBXLoader: unknown attribute mapping type ' + infoObject.mappingType );

		}

		if ( infoObject.referenceType === 'IndexToDirect' ) index = infoObject.indices[ index ];
		const from = index * infoObject.dataSize;
		const to = from + infoObject.dataSize;
		return slice( dataArray, infoObject.buffer, from, to );

	}

	const tempEuler = new THREE.Euler();
	const tempVec = new THREE.Vector3(); // generate transformation from FBX transform data
	// ref: https://help.autodesk.com/view/FBX/2017/ENU/?guid=__files_GUID_10CDD63C_79C1_4F2D_BB28_AD2BE65A02ED_htm
	// ref: http://docs.autodesk.com/FBX/2014/ENU/FBX-SDK-Documentation/index.html?url=cpp_ref/_transformations_2main_8cxx-example.html,topicNumber=cpp_ref__transformations_2main_8cxx_example_htmlfc10a1e1-b18d-4e72-9dc0-70d0f1959f5e

	function generateTransform( transformData ) {

		const lTranslationM = new THREE.Matrix4();
		const lPreRotationM = new THREE.Matrix4();
		const lRotationM = new THREE.Matrix4();
		const lPostRotationM = new THREE.Matrix4();
		const lScalingM = new THREE.Matrix4();
		const lScalingPivotM = new THREE.Matrix4();
		const lScalingOffsetM = new THREE.Matrix4();
		const lRotationOffsetM = new THREE.Matrix4();
		const lRotationPivotM = new THREE.Matrix4();
		const lParentGX = new THREE.Matrix4();
		const lParentLX = new THREE.Matrix4();
		const lGlobalT = new THREE.Matrix4();
		const inheritType = transformData.inheritType ? transformData.inheritType : 0;
		if ( transformData.translation ) lTranslationM.setPosition( tempVec.fromArray( transformData.translation ) );

		if ( transformData.preRotation ) {

			const array = transformData.preRotation.map( THREE.MathUtils.degToRad );
			array.push( transformData.eulerOrder );
			lPreRotationM.makeRotationFromEuler( tempEuler.fromArray( array ) );

		}

		if ( transformData.rotation ) {

			const array = transformData.rotation.map( THREE.MathUtils.degToRad );
			array.push( transformData.eulerOrder );
			lRotationM.makeRotationFromEuler( tempEuler.fromArray( array ) );

		}

		if ( transformData.postRotation ) {

			const array = transformData.postRotation.map( THREE.MathUtils.degToRad );
			array.push( transformData.eulerOrder );
			lPostRotationM.makeRotationFromEuler( tempEuler.fromArray( array ) );
			lPostRotationM.invert();

		}

		if ( transformData.scale ) lScalingM.scale( tempVec.fromArray( transformData.scale ) ); // Pivots and offsets

		if ( transformData.scalingOffset ) lScalingOffsetM.setPosition( tempVec.fromArray( transformData.scalingOffset ) );
		if ( transformData.scalingPivot ) lScalingPivotM.setPosition( tempVec.fromArray( transformData.scalingPivot ) );
		if ( transformData.rotationOffset ) lRotationOffsetM.setPosition( tempVec.fromArray( transformData.rotationOffset ) );
		if ( transformData.rotationPivot ) lRotationPivotM.setPosition( tempVec.fromArray( transformData.rotationPivot ) ); // parent transform

		if ( transformData.parentMatrixWorld ) {

			lParentLX.copy( transformData.parentMatrix );
			lParentGX.copy( transformData.parentMatrixWorld );

		}

		const lLRM = new THREE.Matrix4().copy( lPreRotationM ).multiply( lRotationM ).multiply( lPostRotationM ); // Global Rotation

		const lParentGRM = new THREE.Matrix4();
		lParentGRM.extractRotation( lParentGX ); // Global Shear*Scaling

		const lParentTM = new THREE.Matrix4();
		lParentTM.copyPosition( lParentGX );
		const lParentGSM = new THREE.Matrix4();
		const lParentGRSM = new THREE.Matrix4().copy( lParentTM ).invert().multiply( lParentGX );
		lParentGSM.copy( lParentGRM ).invert().multiply( lParentGRSM );
		const lLSM = lScalingM;
		const lGlobalRS = new THREE.Matrix4();

		if ( inheritType === 0 ) {

			lGlobalRS.copy( lParentGRM ).multiply( lLRM ).multiply( lParentGSM ).multiply( lLSM );

		} else if ( inheritType === 1 ) {

			lGlobalRS.copy( lParentGRM ).multiply( lParentGSM ).multiply( lLRM ).multiply( lLSM );

		} else {

			const lParentLSM = new THREE.Matrix4().scale( new THREE.Vector3().setFromMatrixScale( lParentLX ) );
			const lParentLSM_inv = new THREE.Matrix4().copy( lParentLSM ).invert();
			const lParentGSM_noLocal = new THREE.Matrix4().copy( lParentGSM ).multiply( lParentLSM_inv );
			lGlobalRS.copy( lParentGRM ).multiply( lLRM ).multiply( lParentGSM_noLocal ).multiply( lLSM );

		}

		const lRotationPivotM_inv = new THREE.Matrix4();
		lRotationPivotM_inv.copy( lRotationPivotM ).invert();
		const lScalingPivotM_inv = new THREE.Matrix4();
		lScalingPivotM_inv.copy( lScalingPivotM ).invert(); // Calculate the local transform matrix

		let lTransform = new THREE.Matrix4();
		lTransform.copy( lTranslationM ).multiply( lRotationOffsetM ).multiply( lRotationPivotM ).multiply( lPreRotationM ).multiply( lRotationM ).multiply( lPostRotationM ).multiply( lRotationPivotM_inv ).multiply( lScalingOffsetM ).multiply( lScalingPivotM ).multiply( lScalingM ).multiply( lScalingPivotM_inv );
		const lLocalTWithAllPivotAndOffsetInfo = new THREE.Matrix4().copyPosition( lTransform );
		const lGlobalTranslation = new THREE.Matrix4().copy( lParentGX ).multiply( lLocalTWithAllPivotAndOffsetInfo );
		lGlobalT.copyPosition( lGlobalTranslation );
		lTransform = new THREE.Matrix4().copy( lGlobalT ).multiply( lGlobalRS ); // from global to local

		lTransform.premultiply( lParentGX.invert() );
		return lTransform;

	} // Returns the three.js intrinsic THREE.Euler order corresponding to FBX extrinsic THREE.Euler order
	// ref: http://help.autodesk.com/view/FBX/2017/ENU/?guid=__cpp_ref_class_fbx_euler_html


	function getEulerOrder( order ) {

		order = order || 0;
		const enums = [ 'ZYX', // -> XYZ extrinsic
			'YZX', // -> XZY extrinsic
			'XZY', // -> YZX extrinsic
			'ZXY', // -> YXZ extrinsic
			'YXZ', // -> ZXY extrinsic
			'XYZ' // -> ZYX extrinsic
			//'SphericXYZ', // not possible to support
		];

		if ( order === 6 ) {

			console.warn( 'THREE.FBXLoader: unsupported THREE.Euler Order: Spherical XYZ. Animations and rotations may be incorrect.' );
			return enums[ 0 ];

		}

		return enums[ order ];

	} // Parses comma separated list of numbers and returns them an array.
	// Used internally by the TextParser


	function parseNumberArray( value ) {

		const array = value.split( ',' ).map( function ( val ) {

			return parseFloat( val );

		} );
		return array;

	}

	function convertArrayBufferToString( buffer, from, to ) {

		if ( from === undefined ) from = 0;
		if ( to === undefined ) to = buffer.byteLength;
		return THREE.LoaderUtils.decodeText( new Uint8Array( buffer, from, to ) );

	}

	function append( a, b ) {

		for ( let i = 0, j = a.length, l = b.length; i < l; i ++, j ++ ) {

			a[ j ] = b[ i ];

		}

	}

	function slice( a, b, from, to ) {

		for ( let i = from, j = 0; i < to; i ++, j ++ ) {

			a[ j ] = b[ i ];

		}

		return a;

	} // inject array a2 into array a1 at index


	function inject( a1, index, a2 ) {

		return a1.slice( 0, index ).concat( a2 ).concat( a1.slice( index ) );

	}

	THREE.FBXLoader = FBXLoader;

} )();
