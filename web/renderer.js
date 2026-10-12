// WebGPU Model 2: CPU tile layers surround GPU polygon rendering.
const layerShader = `
@group(0) @binding(0) var image: texture_2d<f32>;
struct Screen { size: vec2f, pad: vec2f, origin: vec2f, unused: vec2f }
@group(0) @binding(1) var<uniform> screen: Screen;
@vertex fn vs(@builtin(vertex_index) id:u32)->@builtin(position) vec4f {
 let p=array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));
 return vec4f(p[id],0,1);
}
@fragment fn fs(@builtin(position) p:vec4f)->@location(0) vec4f {
 let at=vec2i((p.xy-screen.origin)/screen.pad.y+vec2f(screen.pad.x,0));
 let c=textureLoad(image,clamp(at,vec2i(0),vec2i(textureDimensions(image))-vec2i(1)),0);
 if(all(c==vec4f(0))){discard;}
 return vec4f(c.bgr,1);
}`;

export async function createRenderer(canvas, onFailure) {
  if (!globalThis.isSecureContext || !navigator.gpu)
    throw Error('WebGPU requires a compatible browser and HTTPS or localhost.');
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw Error('No WebGPU adapter was found.');
  const device = await adapter.requestDevice();
  device.lost.then(info => onFailure('The WebGPU device was lost: ' + info.message));
  device.addEventListener('uncapturederror', e => onFailure('WebGPU: ' + e.error.message));
  const context = canvas.getContext('webgpu');
  if (!context) throw Error('Could not create the WebGPU context.');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({device, format, alphaMode:'opaque'});
  const response = await fetch(new URL('./model2.wgsl', import.meta.url));
  if (!response.ok) throw Error('Could not load model2.wgsl.');
  const modelShader = device.createShaderModule({label:'Model 2',code:await response.text()});
  const layerModule = device.createShaderModule({label:'Capas System 24',code:layerShader});
  for (const shader of [modelShader, layerModule]) {
    const result = await shader.getCompilationInfo();
    const errors = result.messages.filter(m => m.type === 'error');
    if (errors.length) throw Error(errors.map(m => `${m.lineNum}: ${m.message}`).join('\n'));
  }
  const polyPipeline = await device.createRenderPipelineAsync({
    label:'Polígonos Model 2',layout:'auto',
    vertex:{module:modelShader,entryPoint:'vs_poly',buffers:[{arrayStride:64,attributes:[
      {shaderLocation:0,offset:0,format:'float32x2'},
      {shaderLocation:1,offset:8,format:'float32'},
      {shaderLocation:2,offset:12,format:'float32x3'},
      {shaderLocation:3,offset:24,format:'float32x4'},
      {shaderLocation:4,offset:40,format:'uint32x4'},
      {shaderLocation:5,offset:56,format:'uint32x2'}]}]},
    fragment:{module:modelShader,entryPoint:'ps_poly',targets:[{format}]},
    primitive:{topology:'triangle-list',cullMode:'none'},
    depthStencil:{format:'depth32float',depthWriteEnabled:true,depthCompare:'less'}
  });
  const layerPipeline = await device.createRenderPipelineAsync({
    layout:'auto',vertex:{module:layerModule,entryPoint:'vs'},
    fragment:{module:layerModule,entryPoint:'fs',targets:[{format}]},
    primitive:{topology:'triangle-list'},
    depthStencil:{format:'depth32float',depthWriteEnabled:false,depthCompare:'always'}
  });
  const buffer = (size,usage) => device.createBuffer({size,usage:usage|GPUBufferUsage.COPY_DST});
  const screen = buffer(32,GPUBufferUsage.UNIFORM);
  const texram = buffer(0x400000,GPUBufferUsage.STORAGE);
  const luma = buffer(0x20000,GPUBufferUsage.STORAGE);
  const xlat = buffer(0x6000*4,GPUBufferUsage.STORAGE);
  const polyGroup = device.createBindGroup({layout:polyPipeline.getBindGroupLayout(0),entries:
    [screen,texram,luma,xlat].map((b,binding)=>({binding,resource:{buffer:b}}))});
  let vertexBuffer=null, vertexCapacity=0, depth=null, back=null, front=null;
  let backGroup,frontGroup,width=0,height=0,outputWidth=0,outputHeight=0,textureGeneration=-1;
  let enhanced=false,drawDistance=1,displayKey='';
  const extent=()=>{
    const dpr=globalThis.devicePixelRatio || 1, limit=device.limits.maxTextureDimension2D;
    const w=Math.max(1,Math.round(canvas.clientWidth*dpr)),h=Math.max(1,Math.round(canvas.clientHeight*dpr));
    const ratio=Math.min(1,limit/Math.max(w,h));
    return [Math.max(1,Math.round(w*ratio)),Math.max(1,Math.round(h*ratio))];
  };
  const layerGroup = texture => device.createBindGroup({layout:layerPipeline.getBindGroupLayout(0),
    entries:[{binding:0,resource:texture.createView()},{binding:1,resource:{buffer:screen}}]});
  function resize(w,h,ow,oh) {
    if(ow!==outputWidth || oh!==outputHeight){
      depth?.destroy();outputWidth=ow;outputHeight=oh;canvas.width=ow;canvas.height=oh;
      depth=device.createTexture({size:[ow,oh],format:'depth32float',usage:GPUTextureUsage.RENDER_ATTACHMENT});
    }
    if(w===width && h===height)return;
    back?.destroy();front?.destroy();width=w;height=h;
    const descriptor={size:[w,h],format:'rgba8unorm',usage:GPUTextureUsage.COPY_DST|GPUTextureUsage.TEXTURE_BINDING};
    back=device.createTexture(descriptor);front=device.createTexture(descriptor);
    backGroup=layerGroup(back);frontGroup=layerGroup(front);
  }
  return {
    reset() {textureGeneration=-1;displayKey='';},
    setEnhanced(on) {enhanced=on;displayKey='';canvas.classList.toggle('enhanced',on);},
    setDrawDistance(level) {drawDistance=level;enhanced=level>0;displayKey='';canvas.classList.toggle('enhanced',enhanced);},
    prepare(wasm) {
      const [w,h]=enhanced?extent():[496,384];
      const key=`${enhanced}:${w}:${h}`;
      if(key!==displayKey){
        wasm._daytona_set_draw_distance(enhanced?drawDistance:0);
        // Portrait phones keep the complete arcade image, leaving thumb room
        // below it. Wide windows still reveal additional scenery.
        const gameHeight=enhanced?Math.min(h,Math.ceil(w*384/496)):h;
        wasm._daytona_set_display(Number(enhanced),w,gameHeight);displayKey=key;
      }
    },
    draw(wasm) {
      const w=wasm._daytona_width(),h=wasm._daytona_height();
      const [ow,oh]=enhanced?extent():[w,h];resize(w,h,ow,oh);
      const scale=enhanced?Math.min(oh/h,ow/496):oh/h,viewWidth=ow/scale,offset=(w-viewWidth)/2;
      const top=(oh-h*scale)/2;
      device.queue.writeBuffer(screen,0,new Float32Array([viewWidth,h,offset,scale,0,top,0,0]));
      const mem=wasm.HEAPU8; // reacquire after wasm memory growth
      const view=(ptr,size)=>mem.subarray(ptr,ptr+size);
      const uploadLayer=(texture,ptr)=>device.queue.writeTexture({texture},view(ptr,w*h*4),{bytesPerRow:w*4},[w,h]);
      uploadLayer(back,wasm._daytona_background_ptr());
      uploadLayer(front,wasm._daytona_foreground_ptr());
      const gen=wasm._daytona_texture_generation();
      const tp0=wasm._daytona_tex0_ptr(),tp1=wasm._daytona_tex1_ptr();
      if(tp0 && tp1 && gen!==textureGeneration){
        device.queue.writeBuffer(texram,0,view(tp0,0x200000));
        device.queue.writeBuffer(texram,0x200000,view(tp1,0x200000));textureGeneration=gen;
      }
      const lp=wasm._daytona_luma_ptr(),xp=wasm._daytona_xlat_ptr();
      if(lp)device.queue.writeBuffer(luma,0,view(lp,0x20000));
      if(xp)device.queue.writeBuffer(xlat,0,view(xp,0x6000*4));
      const count=wasm._daytona_vertices_count(),size=count*64;
      if(size>vertexCapacity){vertexBuffer?.destroy();vertexCapacity=Math.ceil(size/65536)*65536;
        vertexBuffer=buffer(vertexCapacity,GPUBufferUsage.VERTEX);}
      if(size)device.queue.writeBuffer(vertexBuffer,0,view(wasm._daytona_vertices_ptr(),size));
      const encoder=device.createCommandEncoder();
      const pass=encoder.beginRenderPass({colorAttachments:[{view:context.getCurrentTexture().createView(),
        loadOp:'clear',storeOp:'store',clearValue:{r:0,g:0,b:0,a:1}}],
        depthStencilAttachment:{view:depth.createView(),depthLoadOp:'clear',depthStoreOp:'discard',depthClearValue:1}});
      pass.setViewport(0,top,ow,h*scale,0,1);
      pass.setPipeline(layerPipeline);pass.setBindGroup(0,backGroup);pass.draw(3);
      if(size){
        pass.setPipeline(polyPipeline);pass.setBindGroup(0,polyGroup);pass.setVertexBuffer(0,vertexBuffer);
        const batches=new Uint32Array(mem.buffer,wasm._daytona_batches_ptr(),wasm._daytona_batches_count()*6);
        for(let n=0;n<batches.length;n+=6){
          const x=Math.max(0,Math.floor((batches[n+2]-offset)*scale));
          const y=Math.max(0,Math.floor(top+batches[n+3]*scale));
          const right=Math.min(ow,Math.ceil((batches[n+2]+batches[n+4]-offset)*scale));
          const bottom=Math.min(oh,Math.ceil(top+(batches[n+3]+batches[n+5])*scale));
          if(right<=x || bottom<=y)continue;
          pass.setScissorRect(x,y,right-x,bottom-y);
          pass.draw(batches[n+1],1,batches[n]);
        }
      }
      pass.setScissorRect(0,0,ow,oh);pass.setPipeline(layerPipeline);pass.setBindGroup(0,frontGroup);pass.draw(3);
      pass.end();device.queue.submit([encoder.finish()]);
    }
  };
}
