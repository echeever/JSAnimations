var Linear={}; //holds the objects, for tidiness sake

//// GLOBAL CONSTRUCTORS ////

function system(A,B,C,D,X){
	return new Linear.System(A,B,C,D,X);
}

function plot(sys,size,vars,limits,labels,colors){
	return new Linear.Plot(sys,size,vars,limits,labels,colors);
}

function diagram(sys,size){
	return new Linear.Diagram(sys,size);	
}

function slider(vars,v,chf,title,limits){
	return new Slider(vars,v,chf,title,limits);
}

function tBox(text){
	return new TBox(text);
}

//// CLASSES ////


function Slider(vars,v,chf,title,limits){
	
	var length=200;
	var vert=false;
	
	var container=document.createElement('div');
	document.body.appendChild(container);
	
	var titleSpan=document.createElement('span');
	//titleSpan.style.fontFamily='monospace';
	titleSpan.innerHTML=title;
	container.appendChild(titleSpan);
	
	var numBox=document.createElement('input');
	try{numBox.type='number';}catch(e){}
	numBox.style.width='4em';
	numBox.value=0;
	container.appendChild(numBox);
	
	if(vert)container.appendChild(document.createElement('br'));
	
	var oslide=document.createElement('div');
	oslide.style.display='inline-block';
	oslide.style.width=vert?'auto':length+'px';
	oslide.style.height=vert?length+'px':'auto';
	oslide.style.overflow='scroll'; //the X and Y overflows aren't supported by all
	oslide.style.overflowX=vert?'hidden':'scroll';
	oslide.style.overflowY=vert?'scroll':'hidden';
	container.appendChild(oslide);
	
	var islide=document.createElement('div');
	islide.style.width =vert?'1px':length*10+'px';
	islide.style.height=vert?length*10+'px':'1px';
	oslide.appendChild(islide);
	
	numBox.onchange=function(){
		setVal(+numBox.value);
	}

	oslide.onscroll=vert?function(){
		setVal(oslide.scrollTop/maxNum*range+limits[0]);
	} : function(){
		setVal(oslide.scrollLeft/maxNum*range+limits[0]);
	}
	
	function setVal(n){
		var nval=n.toFixed(fix);
		val=isNaN(nval)?val:nval; //if it's legal
		
		if(numBox.val!=val) numBox.value=val;

		var sval=Math.round((val-limits[0])/range*maxNum);
		if(vert){
			if(oslide.scrollTop!=sval) oslide.scrollTop=sval;
		}else{
			if(oslide.scrollLeft!=sval) oslide.scrollLeft=sval;
		}
		
		vars[v]=val;
		if(chf)
			chf();
	}

	//decide how many decimal points to use based on the upper limit.
	var fix=Math.round(Math.log(limits[1])/Math.log(10))
	fix=(fix<2?-fix+2:0);
	
	var range=limits[1]-limits[0];
	var val=0;
	var maxNum=vert?oslide.scrollHeight-oslide.clientHeight:oslide.scrollWidth-oslide.clientWidth;	

	setVal(vars[v]);
}

function TBox(text){
	var container=document.createElement('div');
	container.style.padding='1px 0px';
	
	var tSpan=document.createElement('span');
	container.appendChild(tSpan);
	
	
	this.place=function place(){
		document.body.appendChild(container);
		return this;
	}
	
	this.set=function set(text){
		tSpan.innerHTML=text;
		return this;
	}
	
	this.place();
	this.set(text||''); //default to blank
	
	
	
}


//the system does the math; the simulation of the model
Linear.System=function System(nA,nB,nC,nD,nXi){

	//system variables
	
	var A=[];
	var B=[];
	var C=[];
	var D=[];
	
	var Xi=[];
	var X=[];
	var U=[];
	var Y=[];
	this.Y=Y; //make it public
	
	//sim stuff
	var t;
	
	var fps=30;  //frames per second
	var   h=0.01;   //time per step;
	var spf=15;  //steps per frame
	
	var tMax=0; //how long to run the simulation. 0=forever
	
	var ssButton;     //the start/stop button
	var stepper;      //the setInterval ID (if defined)

	var pushers=[];   //things to notify every step
	var updaters=[];  //things to notify every frame
	var resetters=[]; //things to notify when we reset (plots)
	var inputs=[];    //things to update (pass time to) every step (sub-step)

	//make the start/stop button
	var container=document.createElement('div');
	document.body.appendChild(container);
	container.className='container';
	
	ssButton=document.createElement('input');	
	ssButton.type='button';
	container.appendChild(ssButton);

	//if parameters were provided
	if(nA)
		setP(nA,nB,nC,nD,nXi);
	
	initial(); //set inital values for Y, 
	//doOutputs();  //update outputs.
	//update();  //update updaters.

	//public setters
	this.tMax=function(v){tMax=v;return this;}
	this.h   =function(v){   h=v;return this;}
	this.spf =function(v){ spf=v;return this;}
	this.fps =function(v){ fps=v;return this;}
	
	
	function initial(nXi,go){
		
  		for(var i in resetters)
			resetters[i].reset();

		
		if(nXi)
			Xi=nXi;
		
		stop();//make the start button
		
		t=0;
		doInputs(t); //get initial input values

		if(!Xi.length){//if no initial conditions given, make them 0;
			X=[];
			for(var i in A) X[i]=0;
		}else{
			X=Xi.slice(0); //copy the array	
		}
		
		doOutputs();
		update();
		
		if(go)
			start();
	}
	
	//takes (A,B,C,D,[x]),
	function setP(nA,nB,nC,nD,nXi){
		A=nA;
		B=nB;
		C=nC;
		D=nD;
		if(nXi){
			Xi=nXi;
		}
		
		//if X is length 0, the U,
		if(!X.length){
			if(B.length>0)for(var i in B[0]) U[i]=0; //U is the width of B's width
			for(var i in C) Y[i]=0;                  //Y is the width of C's height
			initial();
		}
	}
	
	
	this.setP=setP;
	this.initial=initial;
	
	this.getT=function getT(){
		return t;
	}
	
	function start(){
		ssButton.value='stop';
		ssButton.onclick=stop;
		stepper=setInterval(step,1000/fps);
		
		document.onkeydown=function(e){if(e.keyCode==32){stop();return false}}
	}
	function stop(){
		ssButton.value='start';
		ssButton.onclick=start;
		stepper=clearInterval(stepper);
		
		document.onkeydown=function(e){if(e.keyCode==32){start();return false;}}
	}
	function done(){
		ssButton.value='reset';
		ssButton.onclick=reset;
		stepper=clearInterval(stepper);
		
		document.onkeydown=function(e){if(e.keyCode==32){reset();return false;}}
	}
	
	function reset(){
//  		for(var i in resetters)
//			resetters[i].reset();
		initial();
	}
	
	
	function step(){
	
		var i,j;
		
		var K1=[], K2=[], K3=[], K4=[],
		    X1=[], X2=[], X3=[];
		
		for(var s=0;s<spf;s++){
			
			doInputs(t);

			///STEP 1
			for(i in X){	//i is row
				K1[i]=0;
				for(j in X){ //j is column
					K1[i]+=A[i][j]*X[j];
				}
			}
			///STEP 2
			for(i in X){
				X1[i]=X[i]+K1[i]*h/2;
			}
			for(i in X){	//i is row
				K2[i]=0;
				for(j in X){ //j is column
					K2[i]+=A[i][j]*X1[j];
				}
			}
			///STEP 3
			for(i in X){
				X2[i]=X[i]+K2[i]*h/2;
			}
			for(i in X){
				K3[i]=0;
				for(j in X){ //j is column
					K3[i]+=A[i][j]*X2[j];
				}
			}
			///STEP 4
			for(i in X){
				X3[i]=X[i]+K3[i]*h/2;
			}
			for(i in X){	//i is row
				K4[i]=0;
				for(j in X){ //j is column
					K4[i]+=A[i][j]*X3[j];
				}
			}
			
			//weighted average
			for(i in X){
				X[i]=X[i]+(K1[i]+2*K2[i]+2*K3[i]+K4[i])*h/6;
				
				for(j in U){
					X[i]+=B[i][j]*U[j]*h;
				}
				
			}
			
			t+=h;
			doOutputs()
		}

		update();
		
		if(tMax && t>=tMax)
			done();
	}
	

	function doOutputs(){
		//update Y
		for(var i in Y){
			Y[i]=0;
			for(var j in X){
				Y[i]+=X[j]*C[i][j];
			}
			for(var j in U){
				Y[i]+=U[j]*D[i][j];
			}
		}
		for(var i in pushers)
			pushers[i].push();
	}
	
	function update(){		
		for(var i in updaters)
			updaters[i].update();
	}
	
	function doInputs(t){
		for(var i in inputs){
			inputs[i].update(t);	
		}	
	}
	
	this.addUpdater=function addUpdater(thing){
		updaters.push(thing);
	}
	this.addPusher=function addPusher(thing){
		pushers.push(thing);
	}
	this.addResetter=function addResetter(thing){
		resetters.push(thing);
	}
	
	//constructor for inputs
	this.input=function input(v,func){
		new InputFunc(v,func);
		return this;
	}
	
	//an object
	function InputFunc(v,func){
		inputs.push(this);
	
		this.update = function update(t){
			U[v]=func(t); 
		}
	}
}

//the plot plots the data from the System
Linear.Plot=function Plot(size,sys,vars,limits,labels,colors){
	
	//sys is the linked System
	
	//size is [w,h]
	
	//limits is [xMin,xMax,yMin,yMax]
	//       or [xMax,yMin,yMax]  (xMin=0)
	//       or [xMax,yMax]  (xMin=0, yMin=-yMax)

	//vars is an array of indicies of Y (numbers)
	//labels is an array of names for the values being plotted

	//updaters are called each frame,
	//resetters are called on global reset,
	//pushers are called every step (perhaps)?

	var lineAttrs={'stroke-linejoin':'round','stroke-linecap':'round','stroke-width':'1'};

	sys.addUpdater(this);
	sys.addPusher(this);
	sys.addResetter(this);
	
	if(limits){
		if(limits.length==2)
			limits=[0,limits[0],-limits[1],limits[1]];
		else if(limits.length==3)
			limits=[0,limits[0],limits[1],limits[2]];
		//if length==4, we don't need to do anything
		
	}else{ //default
		limits=[0,50,-20,20];
	}
	
	var Y;
	var T;
	
	var pts=[]; //pts holds plotted points. Points are in the form [x,y]. pts[n] is all the points of line n, and pts[n][m] is point m of line n.
	//this.pts=pts;
	
	this.getPts=function(){return pts}
	
	// if vars is not specified, make it all the vars in Y
	if(!vars){
		vars=[];
		for(i in sys.Y){
			vars[i]=i;	
		}
	}
	
	
	var lPadding=20;
	var vPadding=15;
	
	//default colors
	colors=colors?colors:
	           ['#00A', //blue
	            '#A00', //red
	            '#0A0', //green
	            '#AA0', //yellow
	            '#A0A', //magenta
	            '#0AA'];//cyan
	
	var container=document.createElement('div');
	document.body.appendChild(container);
	container.className='container';
	
	var canv=Raphael(container,size[0],size[1]);
	canv.canvas.className.baseVal='plot';
	
	///for dumping data///
	var isDump=false;
	var precision=10;
	
	var dumpBox=document.createElement('textArea');	
	dumpBox.className='plot';
	dumpBox.style.width=size[0]+'px';
	dumpBox.style.height=size[1]+'px';
	dumpBox.style.display='inline-block';
	dumpBox.style.overflow='auto';
	dumpBox.style.fontFamily='monospace';
	dumpBox.readOnly=true;
	
	this.dumpBox=dumpBox;
	
	var lastDrawn=[];
	
	var errDist=.5; //allowable error - used by plotting algorithm
	var chunkSize=50;
	var chunkStart=[];
	var oldLines=[];
	this.oldLines=oldLines;
	
	var lines=[]; //the Raphael Path objects
	var paths=[]; //the path strings "M1,1L2,5..."
	
	var scaleX=(size[0]-lPadding)/(limits[1]-limits[0]); //  width/(xMax-xMin)
	var scaleY=(size[1]-2*vPadding)/(limits[3]-limits[2]); // height/(yMax-yMin)
	
	var offsX=-limits[0]*scaleX+.5+lPadding;
	var offsY=-limits[3]*scaleY+.5-vPadding;
	
//	var offsY=Math.floor(size[1]/2)+.5; //the floor and the +.5 make 0 lie on a pixel somehow
										//that makes the axis 1 pixel wide instead of two
										
	//the horizontal and vertical axis lines
	var axis=canv.path(['M',0,-offsY,'h',size[0],
	                    'M', offsX,0,'v',size[1]]);
	axis.attr({'stroke-width':.5,'stroke':'#999'});
	
	var aLabels=canv.set();
	aLabels.push(canv.text(lPadding/2,vPadding,limits[3]));
	aLabels.push(canv.text(lPadding/2,size[1]-vPadding,''+limits[2]));
	
	aLabels.attr({fill:'#999'});
	
	function newChunk(v){
		if(lines[v]){
			//lines[v].attr({'stroke-opacity':'.2'});
			if(!oldLines[v])
				oldLines[v]=[];
			oldLines[v].push(lines[v]);
		}
		//for(var i in lines)lines[i].hide();
		//create the lines
		lines[v]=canv.path();
		lines[v].attr(lineAttrs);
		lines[v].attr({stroke:colors[v%colors.length]});
		//lines[v].toBack();
		if(labels){ //pull the legend in front of the new lines
			legendBox.toFront();
			legend.toFront();
		}
		
		chunkStart[v]=lastDrawn[v]?lastDrawn[v]:0;
	}

	//make the legend
	if(labels){
		
		//we need the rectangle to fit it's contents.
		//we'll create the rectangle with size 1x1,
		//	then we make the legend lines and labels
		//	then we size the recatnage to fit the text using getBBox()
		//	and move it as to fulfill the margin parameter
		
		var lMargin=10;
		var lRad=2;
		var sampleLength=30;
		
		var lineHeight=14;
		
		var legend=canv.set();
		
		var legendBox=canv.rect(0,0,1,1,lRad);
		
		var sample;
		for(var v=0;v<vars.length;v++){
			sample=canv.path(['M',13,v*lineHeight+12,'h',sampleLength]);
			
			sample.attr  ({stroke:colors[v%colors.length]});
			
			legend.push(canv.text(sampleLength+22,v*lineHeight+12,labels[v]));
			legend.push(sample);
		}
	
		legend.attr(lineAttrs);
		legend.attr({'text-anchor':'start'});
		
		//LEG=legend;
		
		var legBox=legend.getBBox();
		var lSize=[legBox.width+22,legBox.height+12];
		
		legendBox.attr({width:lSize[0],height:lSize[1],'stroke-width':.5,stroke:'#AAA',fill:'#FFF','fill-opacity':.85});
		legend.toFront(); //pull in front of the box
		//legend.push(legendBox);
		legendBox.translate(size[0]-lSize[0]-lMargin-2,lMargin);
		legend.    translate(size[0]-lSize[0]-lMargin-2,lMargin);
	
	}
	
	
	//push new values onto the Y vector	
	function pushVals(){
		
		/// push the new data onto the Y and T vectors. ///
		// this is only used by the data dump these days...
		var vals=[];
		for(var i=0;i<vars.length;i++){
			vals.push(sys.Y[vars[i]]);
		}
		Y.push(vals);
		T.push(sys.getT());
		
		
		/// do the thing with the pts[] ///
		
		if(pts.length!=vars.length){ //at the beginning
			for(var v in vars){      //create the pts[v] vectors
				pts[v]=[];
			}
		}
		for(var i=0;i<vars.length;i++){
			
			var pt=pts[i];
			
			var ct=sys.getT();    //turns out getters are inefficient...
			var cy=sys.Y[vars[i]];
			
			if(pts[i].length<3){		//we'll blindly keep the first three points
				pts[i].push([ct,cy]);
			}else{						//for the rest, we do this crazy thing
				
				//pt[n]  : previous point
				//pt[n-1]: point after the last anchor point (used to find slope)
				//pt[n-2]: the last anchor point
				
				var n=pt.length-1;
				//we'll find the slope at the previous point
				var slope=(pt[n-1][1]-pt[n-2][1])/(pt[n-1][0]-pt[n-2][0]);
				//and project that line to the current time, and find the difference
				var diff=cy-(pt[n-1][1]+(ct-pt[n-1][0])*slope);
				
				//if the difference is unacceptable  //, or if time hasn't changed (jk)
				if(Math.abs(diff)>errDist/scaleY){   // || !(pt[n-1][0]-pt[n-2][0])){
					//previous point becomes new anchor
					//current point becomes new anchor+1
					//current point also becomes previous point
					pt[n-1]=pt[n];
					pt[n]=[ct,cy];
					pt.push([ct,cy]);
					
					//for illustrating points
					//canv.circle(pt[n-1][0]*scaleX+offsX,-(pt[n-1][1]*scaleY+offsY),1.5).attr({'fill':'none','stroke':colors[i%colors.length],'stroke-width':.3});
					
				}else{ //otherwise just update the last index
					pt[n]=[ct,cy];
				}
			}
		}
	}
	
	
	function redraw(){
		for(var v=0;v<vars.length;v++){
			
			if(pts[v].length-chunkStart[v]>chunkSize || !paths[v]){
				newChunk(v)	
			}
			
			var n0=(chunkStart[v])-2*(chunkStart[v]>0)+1;

			paths[v]='';
			//paths[v]+='M'+(pts[v][0][0]*scaleX+offsX)+','+-(pts[v][0][1]*scaleY+offsY);
			for(var n = n0; n<pts[v].length; n++){
				if(n==n0)
					paths[v]+='M'+(pts[v][n-1][0]*scaleX+offsX)+','+-(pts[v][n-1][1]*scaleY+offsY);
					
				paths[v]+='L'+(pts[v][n][0]*scaleX+offsX)+','+-(pts[v][n][1]*scaleY+offsY);
			}
			lines[v].attr({path:paths[v]});
			lastDrawn[v]=n-1;
		}	
	}
	
	//called every step
	this.push=function push(){	
		pushVals();
		//step();
	}
	
	//called every frame
	this.update=function update(){ //called by the System
		//pushVals();
		step();
	}
	
	//happens every frame (and in the beginning)
	function step(){
		if(isDump){
			//dump();  //problematic when we're getting ALL the data - maybe if we make it append instead of replace. maybe.
		}else{
			if(T[T.length-1]<=limits[1]+.1) //if we're within plot limits
				redraw();
		}
	}
	
	//clear the plot
	this.reset=function reset(){
		Y=[];
		T=[];
		pts=[];
		lastDrawn=[];
		for(var v in vars)
			newChunk(v);
		for(var i in oldLines){
			for(var j in oldLines[i]){
				oldLines[i][j].remove();	
			}
		}
	}
	
	//make the double-click thing happen
	container.ondblclick=function(e){ togDump(); }
	
	
	function dump(){
		
		//this is REALLY inefficient - if we made it more efficient (append) we might be able to do it realtime
		var dumpText='';
		for(var i in Y){
			dumpText+=T[i].toPrecision(6).slice(0,6)+' ';
			for(var j in Y[i]){
				dumpText+=((Y[i][j]>=0)?' ':'')+Y[i][j].toPrecision(((Math.abs(Y[i][j])<1)?precision-1:precision))+' ';
			}
			dumpText+='\n';
		}
		
		//are we at the bottom?
		var bottom= (dumpBox.scrollTop+dumpBox.clientHeight == dumpBox.scrollHeight);

		//update text
		dumpBox.innerHTML=dumpText;
		
		//if we were at the bottom, scroll to the bottom.
		if(bottom)
			dumpBox.scrollTop = dumpBox.scrollHeight-dumpBox.clientHeight;
			
		
		//dumpBox.select();
	}
	
	function togDump(){
		if(isDump){ //undump
			container.removeChild(dumpBox);
			container.appendChild(canv.canvas);
			redraw();
			isDump=false;
		}else{
			container.removeChild(canv.canvas);
			container.appendChild(dumpBox);
			dump();
			//dumpBox.select();
			isDump=true;
		}
	}
	
	this.reset();
	pushVals();
	step();
}

//The Diagram lets us draw various kinds diagrams, which can be animated using a System
Linear.Diagram=function Diagram(size,sys){

	//diagrams now also have lScale, which scales linear values (masses and wheels)
	//	this is not for rotation, which might need it's own value
	
	var lScale=1; //linear scale - default to 1.
	var rScale=1; //rotation scale-default to 1.
	
	this.lScale=function(scl){lScale=scl;return this;};
	this.rScale=function(scl){rScale=scl;return this;};
	
	var theDiagram=this;
	
	var container=document.createElement('div'); //the div that will hold the vector canvas
	document.body.appendChild(container);        //append it to the document
	container.className='container';
	
	var canv=Raphael(container,size[0],size[1]);
	canv.canvas.className.baseVal='diagram';
	
	var bgColor='#FAFAFA';	//sometimes things erase areas by filling them with the bgColor.
	
	
	var updaters=[]; //things to update every frame
	
	//used for all text.
	var textAttribs={'font-size':16,'font-style':'italic','font-family':'serif'}

	//called by the system
	this.update=function update(){
		for(var i in updaters){
			updaters[i].update();
		}
	}
	
	var Y=sys?sys.Y:[]; //get the system's Y vector, or make an empty one
	
	if(sys) sys.addUpdater(this);
	
	
	/* ---- public "CONSTRUCTOR" functions ---- */
	
	this.axis = function(origin,dir){ return new Axis(vect(origin[0],origin[1]),dir)}
	this.mass = function(v,label,axis,rest,wheel,w,h,fname,fnameright){
		return new Mass(v,label,axis,rest,wheel,w,h,fname,fnameright)}
	this.spring=function(label,axis,mA,mB,off){return mkLink( 0,label,axis,mA,mB,off)}
	this.dash = function(label,axis,mA,mB,off){return mkLink( 1,label,axis,mA,mB,off)}
	this.rope = function(label,axis,mA,mB,off){return mkLink(-1,label,axis,mA,mB,off)}

	this.wall = function(p,s,borders){return new HashBox(p,s,borders)}
	//used by thermal systems to indicate insulation
	this.block= function(p,s,label,color)   {return new   Block(p,s,label,color)}
	
	//arrow() can be called in two ways:
	//(v,A,rest,off,scale,name,namePos) or (v,[x,y],angle,scale,name,namePos)
	this.arrow = function(v,a,b,c,d,e,f){
		if(a.length) //a must be an [x,y] vector
			return new Arrow(v,a,b,c,d,e);
		else         //a is probably an Axis
			return new Arrow(v,[a.x(b)-Math.dsin(a.angle)*c,a.y(b)+Math.dcos(a.angle)*c],a.angle,d,e,f);
	}
	
	this.lArrow=function(p1,p2,label,dashed){return new LinArrow(p1,p2,label,dashed)}
	
	//Element1 is for circuit elements on one point
	this.node     = function(p,label){return new Element1('N',p,label)}
	this.ground   = function(p,label){return new Element1('G',p,label)}
	
	//Element2 is for elements between two points
	this.wire     = function(p1,p2,label){return new Element2( 'W',p1,p2,label)}
	this.resistor = function(p1,p2,label){return new Element2( 'R',p1,p2,label)}
	this.capacitor= function(p1,p2,label){return new Element2( 'C',p1,p2,label)}
	this.inductor = function(p1,p2,label){return new Element2( 'L',p1,p2,label)}
	this.source   = function(p1,p2,label){return new Element2( 'S',p1,p2,label)}
	this.sourceI  = function(p1,p2,label){return new Element2('Si',p1,p2,label)}
	this.sourceV  = function(p1,p2,label){return new Element2('Sv',p1,p2,label)}

	//terminals can have 1 or two terminals
	this.terminal = function(a,b,c){
		if(typeof b=='object' && typeof b[0]=='number'){
			return new Element2( 'T',a,b,c);
		}else{
			return new Element1( 'T',a,b);
		}
	}



	this.opAmp  = function(p1,p2,label,w){return new OpAmp(p1,p2,label,w)}

	this.meter=function(v,loc,range,label){return new Meter(v,loc,range,label)}
	this.text=function(p,label){return new Text(p,label)}
	this.line=function(p1,p2,w){return new Line(p1,p2,w)};
	this.coil=function(p1,p2,w,r){return new Coil(p1,p2,w,r)}
	
	this.axisR=function(origin,proj){return new AxisR(origin,proj)}
//	this.cylinder=function(v,name,A,loc,w,r){return new Cylinder(v,name,A,loc,w,r)}
	this.cylinder=function(v1,v2,name,A,loc,w,r,f,fname){return new Cylinder(v1,v2,name,A,loc,w,r,f,fname)}
	this.pad=function(name,A,loc,w,r){return new Pad(name,A,loc,w,r)}

	//aArrow can take different kinds of arguments:
	//label,A,loc,r,ang,leng,lScale,w
	//name,[cx,cy],([rx,ry] or r),ang,leng,lScale,w
	//where ang and leng are
	this.aArrow=function(a,b,c,d,e,f,g,h){
		
		if(b.orig){
			return new ArcArrow(a,[b.orig[0]+c,b.orig[1]],[d*b.px,d],e,f,g,h);
		}else{
			if(c.length)
				return new ArcArrow(a,b,c,d,e,f,g);
			else
				return new ArcArrow(a,b,[c,c],d,e,f,g);
		}
		
	}

	

	this.wheel = function(vt,vr,name,A,rest,r,bracket){return new Wheel(vt,vr,name,A,rest,r,bracket)}

	this.vessel=function(p,s,open,label){return new Vessel(p,s,open,label)}
	this.pipe=function(p1,p2,w,label){return new Pipe(p1,p2,w,label)}
	this.mixer=function(p1,p2,w,label){return new Mixer(p1,p2,w,label)}

	this.motor=function(vr,vi,p,s,dir){return new Motor(0,vr,vi,p,s,dir)};
	this.galv= function(vr,vi,p,s,dir){return new Motor(1,vr,vi,p,s,dir)};

	this.speaker= function(vm,vb,vi,p,s,angle,dir){return new Speaker(vm,vb,vi,p,s,angle,dir)};

	/* ---------------------------------------- */


	//used by spring(), dash(), and rope()
	function mkLink(type,name,axis,mA,mB,off){
		var v1,v2,o1,o2,h1,h2; //Y var, offset, home
		
		if(typeof mA=='object'){
			v1=mA.v;
			o1=mA.w/2; //half the width of the mass.
			h1=mA.rest;
		}else{
			v1=-1; //-1 means it's not assigned to a Y output; stationary	
			o1=0;
			h1=mA;
		}
		
		if(typeof mB=='object'){
			v2=mB.v;
			o2=mB.w/2;
			h2=mB.rest;
		}else{
			v2=-1;
			o2=0;
			h2=mB;
		}
		
		//make sure p1<p2
		if(h2>h1)
			return new Linkage(type,name,axis,v1,v2,h1+o1,h2-o2,off);	
		else
			return new Linkage(type,name,axis,v2,v1,h2+o2,h1-o1,off);	
	}
	
/*	there are several ways to define labels:
		'L' or ['L'] - Label, placed in the element's default spot
		['L', 'Q'] (where Q is n,s,e,w) - placed to the North, South, etc. as defined by the element
		['L', n] - if n==0, placed at the default location.
	               If n==1, another default location, depending on the element, e.g. the other side (for circuit elements)
		['L', [x,y]] - placed at a fixed [x,y] offset from the center of the element 
		['L', [x,y],align]                    with alignment according to align, defaulting to 0 (middle)
	
	ther'll be a standard way for elements to specify N,S,E,W, and default, offsets:
		it's an array:
			0: N
			1: S
			2: E
			3: W
			4: default
			5: -default
		For example: [[  0,-20], //n
		              [  0, 20], //s
		              [ 30,  0], //e
		              [-30,  0], //w
		              [  0, 20, 0], //d    //the third number is alignment. For N,S,E,W, this will default to 0,0,1,-1
		              [  0,-20, 0]] //d2
	
	we'll also need a way of specifying text alignment.
	
	perhaps this funciton could just return a Raphael.text object.
		the ploblem with that is if there's a label that moves differently depending on location...
	maybe it will return:
		[x,y,label,align], where align is middle, start, or end
	
	 */
	function doLabel(label,defs,p){
		var txt;    //text
		var off; //offset
		var aln;     //allignment
		
		if(typeof label=='object'){             //not just a string
			txt=label[0];
			if(typeof label[1]=='object'){      //it's [x,y]. Our job is easy
				off=label[1];
				aln=label[2]||0; //default to 0 (centered)
			}else if(typeof label[1]=='string'){//it's n,s,e,w
				switch(label[1].toUpperCase()){
					case 'N': off=defs[0]; aln= 0; break;
					case 'S': off=defs[1]; aln= 0; break;
					case 'E': off=defs[2]; aln= 1; break;
					case 'W': off=defs[3]; aln=-1; break;
					default : off=defs[4]; aln=defs[4][2];
				}
			}else{ //it's either 0, 1, or undefined, for the defaults
				if(label[1]){ //not 0 or undefined --default2
					off=defs[5]; aln=defs[5][2];
				}else{        //0 or undefined -- default
					off=defs[4]; aln=defs[4][2];
				}
			}
		}else{//just a string (or number); use default
			txt=label; off=defs[4]; aln=defs[4][2];
		}
		
		if(txt===undefined)txt="";
		
		var anch; //anchor
		switch(aln){
			case  1: anch='start'; break;	
			case -1: anch='end'  ; break;	
			case  0: 
			default: anch='middle';	
		}
	
		return canv.text(p[0]+off[0],p[1]+off[1],txt)
			.attr('text-anchor',anch)
			.attr(textAttribs);
	}

	//this seemed like a good idea at the time...
	function vect(x,y){return {x:x,y:y}}


	/////TRANSLATING AND THERMAL SYSTEMS/////

	//A linear axis is used by translating systems
	function Axis(O,dir){
		
		var angle,D;
		
		if((typeof dir)=='number'){
			angle=dir;
			D=vect(Math.dcos(dir),Math.dsin(dir));	
		}else{
			D=dir;
			angle=Math.atan2(dir.y,dir.x)/Math.PI*180;
		}
		
		angle=Math.amod(angle,360);
		
		this.D=D;
		this.O=O; //origin
		this.angle=angle;
		
		////draw the little symbol////
		var r=7;
		var draw=false; //draw it?
		
		var symbol=canv.set();
		symbol.push(
			canv.circle(O.x,O.y,r),
			canv.path('M'+O.x+' '+O.y+'l'+D.x*r+' '+D.y*r)
		);
		symbol.attr('stroke-width',.4);
	
		if(!draw)
			symbol.hide();
		//// end draw ////	
		
		//returns a point 'offs' along the axis
		this.along=function along(offs){
			return vect(this.x(offs),this.y(offs));
		}
		//just the x
		this.x = function x(offs){
			return this.O.x+this.D.x*offs;
		}
		//just the y
		this.y = function y(offs){
			return this.O.y+this.D.y*offs;
		}
	}

	//represents fixed things; used by translating, as well as thermal systems
	function HashBox(p,s,borders){
		
		var x=p[0];
		var y=p[1];
		var w=s[0];
		var h=s[1];
		
		//if there is a string, make it uppercase
		borders=borders?borders.toUpperCase():'';
				
		var spacing=10;
		
		var hashStr='';
		
		for(var i=-((x+y)% spacing);i<(h+w);i+=spacing){
			hashStr+='M'+x+' '+(y+i)+'l'+w+' '+-w;
		}
		var hashes=canv.path(hashStr);
		hashes.attr('stroke-linecap','square');
		hashes.attr('clip-rect',x+','+y+','+w+','+h);
		hashes.attr('stroke-width',.5);
		
		var lStr="";
		if(~borders.indexOf('N'))
			lStr+='M'+x+' '+y+'h'+w;
		if(~borders.indexOf('S'))
			lStr+='M'+x+' '+(y+h)+'h'+w;
		if(~borders.indexOf('E'))
			lStr+='M'+(x+w)+' '+y+'v'+h;	
		if(~borders.indexOf('W'))
			lStr+='M'+x+' '+y+'v'+h;
		
		var line=canv.path(lStr);
		line.attr('stroke-linecap','square'); //makes them join at right angles better
	}
	
	//A Grey box. Used to represent thermal resistance
	function Block(p,s,label,color){
		

		//p: [x,y] upper-left point
		//s: [w,h] size
		var color=color || '#E1E1E1';
		
		// -.1 makes it line up with other things a little better
		var rect=canv.rect(p[0],p[1]-.1,s[0],s[1]);
		rect.attr({fill:color,'stroke-width':1});
		
		var loff=12;
		var lab=doLabel(label,[[0,-s[1]/2-loff],
		                       [0, s[1]/2+loff],
		                       [ s[0]/2+loff,0],
		                       [-s[0]/2-loff,0],
		                       [0,0,0], [0,0,0]],
		                      [p[0]+s[0]/2,p[1]+s[1]/2]);
		}
	
	//General-purpose text (particularly for labeling thermal capacitance)
	function Text(p,label){
		
		var lab=doLabel(label,
		      [[0,-8],[0,8],[0,0],[0,0],[0,0,0],[0,0,0]],p);
	}
	
	//General-purpose line
	function Line(p1,p2,w){
		var defaultW=4;
		var path=canv.path(['M',p1[0],p1[1],'L',p2[0],p2[1]]);
		path.attr({'stroke-width':(w||defaultW)});
	}
	
	//For heat sources
	function Coil(p1,p2,w,r){
		w=w||35; //w defaults to 35
		r=r||7; //r defaults to 7
		//p1 and p2 are [x,y] tuples
		
		var angle=Math.angle(p1,p2);
		var leng =Math.dist(p1,p2);
		
		var pathArr=[];
		
		//var r=5.5;
		
		var rx=r;   //radii of ellipses
		var ry=r*6/7;
		
		var dy=r*7.5/7;
		var ex=r*5.5/7; //the ends are special
		var ey=r*9.5/7;
		
		var n=Math.ceil((w-2*ey)/dy);
		
		w=ey*2+dy*(n-1); //coil length
			
		pathArr=['M',0,-w/2,'h',leng,'a',rx,ry,0,1,1,-ex,ey];
	    for(var i=1;i<n;i++)
	    	pathArr.push([rx,ry,0,1,1,0,dy]);
	    pathArr.push([rx,ry,0,1,1,ex,ey,'h',-leng]);
		
				
		var path=canv.path(pathArr);
		path.translate(p1[0]+.5,p1[1]+.5);
		path.rotate(angle,p1[0],p1[1]);
		
	}
	
	//The Mass object; used in translational systems
	function Mass(v,label,A,rest,wheel,w,h,flabel,fnameright){
	
		w=w||0;
		h=h||0;
		
		//make some things public
		this.v=v;
		this.rest=rest;
		this.w=w;
	
		var loc =[0,0]; //locaiton
		var ploc=[0,0];//prevois location
		
		var name=name;//name
		
		

		
		fnameright=fnameright?1:0;
		
		//size: x is along axis, y is perp. to axis. (as if the axis is horizontal, though this may not be the case)
		var size=vect(w,h);
	
		//radius of wheels, 0 for no wheels
		var wheeld=0;
		var frictd=0;
	
		this.handleDist=size.x/2;
	
		//create graphics
		var box=canv.rect(-size.x/2,-size.y/2,size.x,size.y);
		//box.attr({fill:'#FFF','fill-opacity':0});
	
		var stuff=canv.set();
		
		stuff.push(box);
		
		if(wheel>0){
			stuff.push(canv.circle(-size.x/7*2,size.y/2+wheel/2,wheel/2),
					   canv.circle( size.x/7*2,size.y/2+wheel/2,wheel/2));
		}
		if(wheel<0){
			wheel*=-1;
			var n=Math.floor(size.x*3/4/wheel);
			var strt=-(n*wheel)/2;
			
			var pathStr='M'+strt+','+(size.y/2+1);
			
			for(var i=0;i<n;i++){
				pathStr+='l'+wheel+','+wheel+'m'+-wheel+',0l'+wheel+','+-wheel;
			}
			
			var xxxx=canv.path(pathStr);
	
			stuff.push(xxxx);
		}
		
		//we seem to need to specify _some_ x offset
		stuff.rotate(A.angle,1e-9,0);
		
		var loff=12; //for NSEW, offset from edge
		stuff.push(doLabel(label,[[0,-h/2-loff],
		                          [0, h/2+loff],
		                          [ w/2+loff,0],
		                          [-w/2-loff,0],
		                          [0,0,0],[0,0,0]],
		                         [0,0]));
			
		
		//var fnameright=1; //false => left, true=right;
		
		stuff.push(doLabel(flabel,[[0,-wheel/2-12],
		                           [0, wheel/2+12],
		                           [ w/2+7,-3],
		                           [-w/2-7,-3],
		                           [ w/2+7,-3, 1],
		                           [-w/2-7,-3,-1]],
		                          [0,h/2+wheel/2]));
	
		
		updaters.push(this);
	
		this.update=function update(){
			
			val=~v?Y[v]*lScale:0; //if it doesn't exist, make it 0.
			
			ploc=loc.slice(0); //copy the array
			
			loc=[A.x(rest+val),A.y(rest+val)];
	
			stuff.translate(loc[0]-ploc[0],loc[1]-ploc[1]);
			//stuff.attr({translate:'200,200'});
		}
		
		this.update();
		
	}
	
	//Springs and Dashpots (in translational systems)
	function Linkage(type,label,A,v1,v2,o1,o2,off){ //Y vars, offsets
	
		//type: 1:dashpot, 0:spring, -1:rope
	
		//off is offset from axis
		if(!off)
			var off=0;
		
		p1=o1; //endpoints
		p2=o2;
		
		//center location, for the label
		var cloc=[0,0];
		var pcloc=[0,0];
		
		var leng=p2-p1; //length (resting)
		var disp=0;           	  //displacement
		
		//for dashpots
		var dashWidth=.4;
		var pRatio=.75;
		
		//for springs
		var wr=13; //pitch (resting) (for springs)
		var w=wr;  //pitch (dynamic)
		var n=Math.abs(Math.round(leng/2/wr)); //number of coils
		var ends=(leng-wr*n)/2;//space before and after the coil
		
		//for both
		var h=13; //diameter
		
		var path=canv.path("");
		path.attr('stroke-linejoin','round');
		
		
		var loff=h+5; //for NSEW, offset from edge
		var lab=doLabel(label,[[0,-loff],
		                       [0, loff],
		                       [ loff,0],
		                       [-loff,0],
		                       [A.D.y*( loff),A.D.x*(-loff), Math.round(A.D.y/(2*Math.SQRT1_2))],
		                       [A.D.y*(-loff),A.D.x*( loff),-Math.round(A.D.y/(2*Math.SQRT1_2))]],
		                      [A.D.y*off,A.D.x*off]);
		
	//	var theLabel=canv.text(A.D.y*off+lab[0],A.D.x*off+lab[1],lab[2])
	//	         .attr('text-anchor',lab[3])
	//	         .attr(textAttribs);
		
		/*
		var theLabel=canv.text(0,0,name);
		label.attr(textAttribs);
		*/
		
		updaters.push(this);
		
		this.update=function update(){
			
			p1=(~v1?Y[v1]*lScale:0)+o1; //endpoints
			p2=(~v2?Y[v2]*lScale:0)+o2;
			
			//displacement
			disp=(p2-p1)-leng;
		
			//the .5 offset makes things line up a little better 
			var pathArr = ['M',(A.x(p1)+.5),A.y(p1)];
			pathArr.push(['v',off]);
	
			if(!~type){     //-1 = rope
				pathArr.push(['h',leng+disp]);
			}else if(type){ //1 = dashpot
			
				pathArr.push(['h',leng/2,      //left shaft
				              'm0 '+-h*pRatio/2,	   //plunger
				              'v',h*pRatio,      
				              'm',-leng*dashWidth/2+disp, -h/2-h*pRatio/2,   //casing
				              'h',leng*dashWidth,'v',h,'h',-leng*dashWidth,     
				              'm',leng*dashWidth,' ',-h/2,//right shaft
				              'h',leng/2-leng*dashWidth/2]);
				
			}else{   // 0 = spring
				
				w=(leng+disp-ends*2)/n;
				
				pathArr.push(['h',ends,'l',w/4,-h/2]);
				for(var i=1;i<n;i++){
					pathArr.push(['l',w/2,h,'l',w/2,-h]);
				}
				pathArr.push(['l',w/2,h,'l',w/4,-h/2,'h',ends]);
			}
			
			pathArr.push(['v',-off]);

					
			path.attr('path',pathArr);
			path.rotate(A.angle,A.x(p1),A.y(p1));
			
			pcloc=cloc.slice(0);//copy
			cloc=[A.x((p1+p2)/2),
			      A.y((p1+p2)/2)];
			
			lab.translate(cloc[0]-pcloc[0],
			              cloc[1]-pcloc[1]);
			
		}
		
		this.update();
		
	}
	
	//General-purpose arrow
	function Arrow(v,p,angle,scale,label){

		var mag=scale||2; //default to 2
		
		var minVal=.5; //if scaled value is less than this, make the diamond
		

		var head=canv.path('M0,0');
		var line=canv.path('M0,0');
		line.attr({'stroke-width':2});
		head.attr({stroke:'none',fill:'black'});
		
		var arrow=canv.set(line,head);
		//head.translate(1,1);
		arrow.rotate(angle,p[0],p[1]);

		var xOff=8;
		var yOff=14;
		var lab=doLabel(label,[[0,-yOff],
		                       [0, yOff],
		                       [ xOff,0],
		                       [-xOff,0],
		                       [ xOff*Math.dsin(angle),-yOff*Math.dcos(angle), Math.round(Math.dsin(angle)/(2*Math.SQRT1_2))],
		                       [ xOff*Math.dsin(angle), yOff*Math.dcos(angle),-Math.round(Math.dsin(angle)/(2*Math.SQRT1_2))]],
		                      p);
	
		updaters.push(this);
		
		p[1]-=.5;//pointy pixels
	
		this.update=function update(){
			//this might be unnecissarily complicated. Or too simple perhaps.
			//and not scalable. hmpf -- scale()?
			
			var mval=((v<0)?~v:sys.Y[v])*mag;

			
			if(mval > minVal){
				head.attr({path:['M',p[0],p[1],'m',mval,0,'l',-2,-3.5,'c',4,2,12,3,17,3.5,  -5,.5,-13,1.5,-17,3.5,'Z']});
			}else if(mval < -minVal){
				head.attr({path:['M',p[0],p[1],'m',mval,0,'l',2,-3.5,'c',-4,2,-12,3,-17,3.5,  5,.5,13,1.5,17,3.5,'Z']});
			}else{
				head.attr({path:['M',p[0],p[1],'m',0,0-3.5,'c', 2, 2, 5, 3.5, 10, 3.5,  -5, .5,-8, 1,-10, 3.5,
				                                               -2,-2,-5,-3.5,-10,-3.5,   5,-.5, 8,-1, 10,-3.5]});
			}
			
			line.attr({path:['M',p[0],p[1],'m',0,0,'l',mval,0]});
		}
		
		this.update();

	}
	
	
	//linear arrow. Thinner and more static than Arrow.
	//for indicating direction, constant flow, etc.
	function LinArrow(p1,p2,label,dashed){
		
		p1[0]-=.5; //please the pixel gods
		p1[1]-=.5;
		p2[0]-=.5;
		p2[1]-=.5;
		
		var sclX=.7; //we're we-using the head from the think arrow, so we need to scale it.
		var sclY=.8;
				
		var l=Math.dist(p1,p2); //length
		var a=Math.angle(p1,p2);//angle
		
		var shaft=canv.path(['M',p1[0],p1[1],
		                     'h',l]).rotate(a,p1[0],p1[1]);
		                     
		if(dashed)
			shaft.attr('stroke-dasharray','- ');
		                     
		var head=canv.path(['M',p1[0]+l-5,p1[1],
		                    'l',-2,-3.5,
		                    'c',4, 2, 12,  3, 17,3.5,
		                       -5,.5,-13,1.5,-17,3.5,
		                    'Z']).attr({stroke:'none',fill:'#000'}).scale(sclX,sclY).rotate(a,p1[0],p1[1]);
		
		var xOff=8; //label offsets
		var yOff=14;
		var lab=doLabel(label,[[0,-yOff],[0, yOff],
		                       [ xOff,0],[-xOff,0],
		                       [ xOff*Math.dsin(a),-yOff*Math.dcos(a), Math.round(Math.dsin(a)/(2*Math.SQRT1_2))],
		                       [ xOff*Math.dsin(a), yOff*Math.dcos(a),-Math.round(Math.dsin(a)/(2*Math.SQRT1_2))]],
		                      [(p1[0]+p2[0])/2,(p1[1]+p2[1])/2]);
		
	}
	

	//Electrical elements on one point.
	function Element1(type,p,label){
		//N(ode)
		//G(round)
		//T(erminal)

		var pathArr=['M',p[0],p[1]];

		switch(type.charAt(0)){
		case 'N':
			var r=2;
			pathArr.push(['m',   r,0,'a',r,r,0,1,0,0,.0001]);
			break;
		case 'G':
			pathArr.push(['v',15,
			              'm',  -9,0,'h',18,
			              'm', -15,4,'h',12,
			              'm',-8.5,4,'h', 5]);
			break;
		case 'T':
			var r=3;
			pathArr.push(['m',   r,0,'a',r,r,0,1,0,0,.0001]);
			break;
		}
		
		var path=canv.path(pathArr);
		
		if(type=='N')
			path.attr({fill:'#000'});
			
		if(type=='T')//the terminal circled need to be cleared with the backgound color
			path.attr('fill',bgColor);
			
		
		var lab=doLabel(label,[[0,-14],
		                       [0, 14],
		                       [ 10,0],
		                       [-10,0],
		                       [0,-14,0],
		                       [0, 14,0]],
		                      [p[0],p[1]]);
	}
	
	//Electrical elements between two points
	function Element2(type,p1,p2,label){
		
		//R(esistor)
		//C(apacitor)
		//L(enz) (inductor)
		//W(ire)
		//T(erminal)
		//S(ource)
		
		var pathArr=['M',p1[0],p1[1]];
	
		var leng=Math.dist(p1,p2);
		var angl=Math.angle(p1,p2);
		
		var lpos=-1; //-1 above
		var ldist=0;
	
		switch(type.charAt(0)){
		case 'R':
			ldist=18;
			
			//var w=8.5;
			var w=11;
			var h=11;
			
			//var n=4;
			var n=3;
			
			var ends=(leng-w*n)/2;
			
			pathArr.push(['h',ends,'l',w/4,-h/2]);
			for(var i=1;i<n;i++) pathArr.push([w/2,h,w/2,-h]);
			pathArr.push([w/2,h,w/4,-h/2,'h',ends]);
			
			break;
		case 'C':
			ldist=24;
			
			var w=8;
			var h=22;
			
			var ends=(leng-w)/2;
			
			pathArr.push(['h',ends,'m',0,-h/2,'v',h,'m',w,-h,'v',h,'m',0,-h/2,'h',ends]);
			
			break;
		case 'L':	//inductor
			ldist=22;
		
			var rx=6;
			var ry=7;
			var dx=7.5;
			var ex=9.5;
			var ey=5.5;
			
			var n=4;
			
			var cleng=9.5*2+dx*(n-1);
			
			var ends=(leng-cleng)/2;
	
			pathArr.push(['h',ends,'a',rx,ry,0,1,1,ex,ey]);
		    for(var i=1;i<n;i++)
		    	pathArr.push([rx,ry,0,1,1,dx,0]);
		    pathArr.push([rx,ry,0,1,1,ex,-ey,'h',ends]);
		    
		    break;
		case 'W':	//wire
			ldist=15;
			
			pathArr.push(['h',leng]);
			break;
			
		case 'T':
			ldist=0;
			
			var r=3;
			
			pathArr.push(['m',   r,0,'a',r,r,0,1,0,0,.0001,
						  'm',leng,0,'a',r,r,0,1,0,0,.0001]);
			break;
		case 'S':

			var r=12;
			
			ldist=r+13;
						
			pathArr.push(['h',leng/2-r,'a',r,r,0,1,1,0,.0001,'m',r*2,0,'h',leng/2-r]);
			
			break;
		}
		
		var path=canv.path(pathArr);
		
		BG=bgColor;
				
		if(type=='T'){//the terminal circled need to be cleared with the backgound color
			path.attr('fill',bgColor);
		}
		
		
		var lab=doLabel(label,[[0,-ldist],
		                       [0, ldist],
		                       [ ldist-5,0],
		                       [-ldist+5,0],
		                       [ (ldist-5)*Math.dsin(angl),-ldist*Math.dcos(angl),
		                            Math.round(Math.dsin(angl)/(2*Math.SQRT1_2))],
		                       [-(ldist-5)*Math.dsin(angl), ldist*Math.dcos(angl),
		                           -Math.round(Math.dsin(angl)/(2*Math.SQRT1_2))]],
		                      [p1[0]+leng/2*Math.dcos(angl),
		                       p1[1]+leng/2*Math.dsin(angl)]);

		path.attr('stroke-linejoin','round'); //not really noticible, even at 500%
		path.attr('stroke-linecap','square');
		path.rotate(angl,p1[0],p1[1]);
		
		//voltage and current cources need extra attention:
		if(type=='Si'){ //current source; make the arrow
			aL=17;
			var arrow=canv.path(['M',p1[0]+leng/2-aL/2,p1[1],'h',aL*.6,'v',aL*.125,'l',aL*.4,-aL*.125,-aL*.4,-aL*.125,'v',aL*.125]);
			arrow.attr({fill:'#000'});
			arrow.rotate(angl,p1[0],p1[1]);
		}else if(type=='Sv'){ //voltage source; indicate the positive terminal
			var dh= 16;
			var dv=-10;
			var plus=canv.text(p1[0],p1[1],'+');
			plus.translate((leng/2+dh)*Math.dcos(angl)-dv*Math.dsin(angl),
		    	           (leng/2+dh)*Math.dsin(angl)+dv*Math.dcos(angl));
			plus.attr({'font-size':14});
		}
	}
	
	//the op amp is special ang gets it's own object
	function OpAmp(p1,p2,label,spacing){
		
		var ww,w,l,polarity;
		
		var defW=30; //default width
		
		if(!spacing || spacing == 1){
			                   ww= defW;    polarity= 1;
		}else if(spacing==-1){ ww= defW;    polarity=-1;
		}else if(spacing > 0){ ww= spacing; polarity= 1;	
		}else if(spacing < 0){ ww=-spacing; polarity=-1;	
		}
		
		w=ww*1.9; //width
		l=w*1.2;  //length

		var lPos=.45; //label position
		
		//polarity: 1 = plus on top, -1 = minus on top (reversed if pointing left)

		var polPad=10; //padding before plus and minus
		
		var leng=Math.dist(p1,p2);
		var angl=Math.angle(p1,p2);
		
		var ends=(leng-l)/2;//space before and after
		
		var path=canv.path(['M',0,-ww/2,
		                    'h',ends,
		                    'M',0,ww/2,
		                    'h',ends,
		                    'M',l+ends*2,0,
		                    'h',-ends,
		                    'l',-l,w/2,
		                    'v',-w,
		                    'l',l,w/2]);
		
		var minus=canv.text(p1[0]+(ends+polPad)*Math.dcos(-angl)+(+ww/2*polarity)*Math.dsin(-angl),p1[1]+(+ww/2*polarity)*Math.dcos(angl)+(ends+polPad)*Math.dsin(angl),'–');
		var plus =canv.text(p1[0]+(ends+polPad)*Math.dcos(-angl)+(-ww/2*polarity)*Math.dsin(-angl),p1[1]+(-ww/2*polarity)*Math.dcos(angl)+(ends+polPad)*Math.dsin(angl),'+');
		
		var things=canv.set(path,plus,minus);
		things.attr({'font-size':14});
		
		
		var lab=doLabel(label,[[0,-w/2],
		                       [0, w/2],
		                       [ l/2,-12],
		                       [-l/2,0],
		                       [0,0,0],
		                       [0,0,0]],
		                      [p1[0]+leng*lPos*Math.dcos(angl),
		                       p1[1]+leng*lPos*Math.dsin(angl)]);
		
		path.translate(p1[0],p1[1]);
		path.rotate(angl,p1[0],p1[1]);
		
	}
		
	//used to measure tempurature, voltage, etc.
	function Meter(v,loc,range,label){
		
		var rC=2;
		var rN=18;  //needle radius
		var rB=16;  //band radius
		var wB=5;	//band width
		var rT=25;	//text radius
		var aOff=-90;   //angle offset
		var aMM=140;	//angle min/max value (degrees)
		var lOff=30; //label offset


		if(range){
			if(!range.length){
				range=[-range,range];
			}
		}else{
			range=[-10,10];
		}
		
		//range=[0,5,10,15,20];

		//var vMM=minmax?minmax:10;		//value min/max (10 by default)
		
		var val=80;
		
		var valScl=aMM/(range[range.length-1]-range[0])*2;
		
		aOff=-(range[0]+range[range.length-1])/2*valScl-90;
		
		
		var band=canv.path(['M',rB*Math.dcos(range[0]*valScl+aOff),
		                        rB*Math.dsin(range[0]*valScl+aOff),
		        'A',rB,rB,0,+(aMM>90),1,rB*Math.dcos(range[range.length-1]*valScl+aOff),
		                        rB*Math.dsin(range[range.length-1]*valScl+aOff)])
		band.attr({stroke:'#DDD','stroke-width':wB});
		
		
		var needle=canv.path(['M',0,rC,'A',rC,rC,0,1,1,0,-rC,'l',rN,rC,-rN,rC]);
		needle.attr({'stroke-miterlimit':100,stroke:'none',fill:'#000'});


		var tickArr=[];
		for(var i in range){
			tickArr.push('M',Math.dcos(range[i]*valScl+aOff)*(rB-wB/2),Math.dsin(range[i]*valScl+aOff)*(rB-wB/2),
	                     'L',Math.dcos(range[i]*valScl+aOff)*(rB+wB/2),Math.dsin(range[i]*valScl+aOff)*(rB+wB/2));
		}

		TA=tickArr;
	    var ticks=canv.path(tickArr);
		
		ticks.attr({'stroke-width':.5});
		
		
		var lab=doLabel(label,[[0,-rB-12],[0, rB+12],
		                       [ rB+12,0],[-rB-12,0],
		                       [0,rB+12,0],[rB+12,0,1]],
		                      loc);
		
		//var label=canv.text(0,lOff,name);
				
		var stuff=canv.set();
		
		/*canv.text(Math.dcos(   0+aOff)*rT,Math.dsin(   0+aOff)*rT,'0'),*/
		for(var i in range){
			stuff.push(canv.text(Math.dcos(range[i]*valScl+aOff)*rT,Math.dsin(range[i]*valScl+aOff)*rT,''+range[i]));
		}
		
		stuff.push(band,needle,ticks);
		stuff.translate(loc[0],loc[1]);
		stuff.attr({'font-size':9});
		
		//lab.attr(textAttribs);
		
		updaters.push(this);
		
		this.update=function update(){
			val=Y[v];
			needle.rotate(val*valScl+aOff,loc[0],loc[1]);
		}
		
		this.update();
	}

	
	//Axis of Rotation (as opposed to translation)
	function AxisR(orig,proj){ //angle is optional (default to 
		//works kind of like the other kind of axis
			//but instead of translating along it, we're rotating around it.

		//Always horizontal (probably always will be)
		
		//we're using an Oblique projection, in which X and Z dimensions are preserved
		   //but Y is scaled and skewed, as determined by 'proj'
		//proj is in the form [a,b], where a and b are used to map Y onto the 2D plane
		 //see http://en.wikipedia.org/wiki/Oblique_projection#Overview
		//JK. Proj is a number. We don't want two numbers...
		//oblique circles are a pain... (maybe later)
		
		proj=proj||.25; //default
		
		this.orig=orig; //public 
		this.px=proj;
		
		//for drawing...
		/*
		var scl=25;
		
		//draw it
		line=canv.path(['M',orig[0],orig[1],'h', scl,'m',-scl,0,
		                'v',-scl,'m',0,scl,'l',-scl*proj[0],scl*proj[1]]);

		line.translate(.5,.5); //makes pixels happier
		*/

	}
	
	function Cylinder(v1,v2,label,A,loc,w,r,f,flabel){
		
		//f is friction width
		//fname goes near the friction
		
		//three layers:
			//a background, filling the entire shape
			//fill areas, filling shaded regions
			//the outline, stroking the lines
		
		//cylinders can have two labels:
		  //name1 is centered above [below?] the cylinder
		  //name2 lies on the facing face, below the center
		//if names is a string or only has one string, name1 will be used
//		
//		if(typeof names=="object"){ //(array of names)
//			if(names.length==2){
//				name1=names[0];
//				name2=names[1];
//			}else{
//				name1=names[0];
//				name2='';
//			}
//		}else{ //string (or other?)
//			name1=names;
//			name2='';
//		}
		
		
		var rot=0; //rotation, in degrees
		
		var back=canv.path(['M',w,-r,
				            'a',r*A.px,r, 0, 0,1, 0, 2*r,
				            'h',-w,
				            'a',r*A.px,r, 0, 0,1, 0, -2*r,
				            'z']);
		
		back.attr({fill:'#FFF','stroke':'none'});
		var sFill=canv.path(); //side fill
		var fFill=canv.path(); //front fill
		
		fFill.attr({fill:'#E3E3E3','stroke-width':'.2'});
		sFill.attr({fill:'#DDD','stroke-width':'.2'});
		
		
		var outline=canv.path(['M',w,-r,
				               'a',r*A.px,r, 0, 0,0, 0, 2*r,
				               'a',r*A.px,r, 0, 0,0, 0,-2*r,
				               'h',-w,
				               'a',r*A.px,r, 0, 0,0, 0, 2*r,
				               'h',w]);
		
		
		if(f){//friction
			var n=Math.floor(w*4/5/f);
			var strt=-(n*f)/2;
			
			var pathStr='M'+strt+','+(r+1);
			
			for(var i=0;i<n;i++){
				pathStr+='l'+f+','+f+'m'+-f+',0l'+f+','+-f;
			}
			
			var frict=canv.path(pathStr);	
			frict.translate(A.orig[0]+loc+w/2,A.orig[1]);
		
		
			var flab=doLabel(flabel,[[0,-f/2-14],[0,f/2+14],
			                        [w/2+14,0],[-w/2-14,0,0],
			                        [w/2+14,0,0],[-w/2-14,0,0]],
			                       [A.orig[0]+loc+w/2,A.orig[1]+r+f/2]);
		           
		}
		
		
		var lab=doLabel(label,[[0,-r-14],[0, r+14],
		                       [w/2+A.px*r+5,0],[-w/2-A.px*r-5,0],
		                       [w/2,r/2,0],[w/2,-r/2,0]],
		                      [A.orig[0]+loc+w/2,A.orig[1]]);

		back.translate(A.orig[0]+loc,A.orig[1]);
		outline.translate(A.orig[0]+loc,A.orig[1]);
		
		this.update=function update(){
			
			var rot1=(v1<0)?~v1:sys.Y[v1]*rScale;
			var rot2=(v2<0)?~v2:sys.Y[v2]*rScale;
			
			//var rot1=sys.Y[v1];
			//var rot2=sys.Y[v2];
			
			//these describe the end points
			var fillA=((rot1-90)%360+360)%360;
				fillA=fillA*(fillA>=180)+180*(fillA<180);
			var fillB=((rot2+90)%360+360)%360;
				fillB=fillB*(fillB>=180);
			
			if(v1==v2){ //seems rigid
				sFill.attr({path:['M',w+A.px*r*Math.dsin(fillA),r*Math.dcos(fillA),
								  'A',r*A.px,r, 0, 0,0, w+A.px*r*Math.dsin(fillB),r*Math.dcos(fillB),
								  'h',-w,
								  'A',r*A.px,r, 0, 0,1, A.px*r*Math.dsin(fillA),r*Math.dcos(fillA),
								  'Z']});
			}else{   //probably not rigid
				//when we twist a shaft, the rotation along the shaft is a gradient
				       //from rot1 on the left to rot2 on the right
				
				var pitch=Math.abs(w/(rot2-rot1));
				var num=Math.abs((rot2-rot1)/180);//number of stripes
				
				var dir=(rot2-rot1)>0; //true if positive
				
				//starting point
				var pathArr=['M',A.px*r*Math.dsin(Math.amod(rot1-90,180)),
				                      r*Math.dcos(Math.amod(rot1-90,180))];//convoluted much?

				var strt=Math.abs(Math.amod(-(1-2*dir)*rot1-90,180)*pitch);
	
				//we'll go till we hit the end.
				var i=0;
				var nx;
				while((nx=i*180*pitch+strt)<=w){
					pathArr.push(['L',nx,-r+dir*2*r,'m',0,2*r-dir*4*r]);
					i++;
				}
				
				//ending point
				pathArr.push(['L',w+A.px*r*Math.dsin(Math.amod(rot2-90,180)),
				                         r*Math.dcos(Math.amod(rot2-90,180))]);

				sFill.attr({path:pathArr});
				sFill.attr({fill:'none','stroke-width':'.5'});
			
			}
			
			
			fFill.attr({path:['M',w+A.px*r*Math.dsin(rot2-90),r*Math.dcos(rot2-90),
		    'A',r*A.px,r, 0, 0,0, w+A.px*r*Math.dsin(rot2+90),r*Math.dcos(rot2+90),
		    'Z']});
		    
		    sFill.translate(A.orig[0]+loc,A.orig[1]);
		    fFill.translate(A.orig[0]+loc,A.orig[1]);

		}
		
		this.update();

		updaters.push(this);		
	}
	
	//a semi-transparent dark ring (just the front). Place between two Cylinders to indicate friction
	
	function Pad(label,A,loc,w,r){
		
		r+=.3; //so it lines up with stroked things
		
		var shape=canv.path(['M',w,-r,
		                     'a',r*A.px,r, 0, 0,0, 0, 2*r,
		                     'h',-w,
		                     'a',r*A.px,r, 0, 0,1, 0,-2*r,
		                     'h',w]);
		shape.attr({fill:'#000','fill-opacity':.2,'stroke-width':.3});
	
	 	shape.translate(A.orig[0]+loc,A.orig[1]);
	 	
		var lab=doLabel(label,[[0,-r-14],[0, r+14],
		                       [w/2+A.px*r+5,0],[-w/2-A.px*r-5,0],
		                       [0,-r-14,0],[0, r+14,0]],
		                      [A.orig[0]+loc+w/2,A.orig[1]]);
	 	
	}
	
	//this will make arrows that arc around an axis
	function ArcArrow(label,c,r,va,vl,lScale,w){
		//ang: angle on arrow tail
		//leng: length of arrow, in degrees
				
		//var c=[A.orig[0]+loc,A.orig[1]];
		
		//var r=[r*A.px,r];
		
		lScale=lScale||1; //default to 1
		
		w=w||1; //tail stroke width
		
		var dashed=w<0;
		
		var aL=10; //arrow length
		var aW=4;  //arrow width
		
		var hScl=1;
		var tW=Math.abs(w);
		
		var head=canv.path('M0,0').attr({stroke:'none',fill:'black'});
		var tail=canv.path('M0,0').attr({'stroke-width':tW});
		if(dashed)
			tail.attr('stroke-dasharray','- ');
		
		var ang,leng;
		
		this.update=function update(){
			
			head.scale(1,1)//seems to be necissary
			
			ang=-((va<0)?~va:sys.Y[va]*rScale);
			leng=-((vl<0)?~vl:sys.Y[vl])*lScale;
			
			//this intentionally doesn't handle leng>360 gracefully,
			tail.attr('path',['M',-r[0]*Math.dsin(ang),-r[1]*Math.dcos(ang),
			                    'A',r[0],r[1], 0, +(leng>180  || leng< -180),+(leng<0), -r[0]*Math.dsin(ang+leng),-r[1]*Math.dcos(ang+leng)]);
		 	
		 	//head.attr('path',['M', -r[0]*Math.dsin(ang+leng),-r[1]*Math.dcos(ang+leng),
		 	//                    'l',-aL,aW,'m',aL,-aW,'l',-aL,-aW]);
		 	if(r[0]*Math.abs(leng)>50){
			 	head.attr('path',['M',-r[0]*Math.dsin(ang+leng)-3,-r[1]*Math.dcos(ang+leng),'l',-2,-3.5,'c',4,2,12,3,17,3.5,  -5,.5,-13,1.5,-17,3.5,'Z']);
		 	}else{
		 		head.attr('path',['M',-r[0]*Math.dsin(ang+leng),-r[1]*Math.dcos(ang+leng)-3.5,'c', 2, 2, 5, 3.5, 10, 3.5,  -5, .5,-8, 1,-10, 3.5,
				                                               -2,-2,-5,-3.5,-10,-3.5,   5,-.5, 8,-1, 10,-3.5]);
		 	}
		 			 	
		 	tail.translate(c[0],c[1]);
		 	var hAng=ang+leng;
		 	head.rotate(Math.atan2( r[1]*Math.dsin(hAng+0/r[0]*(1-2*(leng>0))),
		 	                       -r[0]*Math.dcos(hAng+0/r[1]*(1-2*(leng>0))))/Math.PI*180+180*(leng<0),
		 	            -r[0]*Math.dsin(hAng),-r[1]*Math.dcos(hAng));
		 	            
		 	head.translate(c[0],c[1]).scale(.6*hScl,.9*hScl);
		}
		
		this.update();
		
		updaters.push(this);
		
		rOff=14;
		var lab=doLabel(label,[[0,-r[1]-14],[0, r[1]+14],
		                       [r[0]+5,0],[r[0]-5,0],
		                       [-(r[0]+rOff)*Math.dsin(ang     ),-(r[1]+rOff)*Math.dcos(ang     ),0],
		                       [-(r[0]+rOff)*Math.dsin(ang+leng),-(r[1]+rOff)*Math.dcos(ang+leng),0]],
		                      c);

	}
	
	//a rotating-translating wheel
	function Wheel(vt,vr,label,A,rest,r,bracket){
		//vt, vr: values for rotation; translation
		//A is a translation axis
		var x0=A.x(rest);
		var y0=A.y(rest);
		
		//bracket is n,e,s,w,h,v (direction, or horizontal/vertical)
		
		var bw=8;   //bracket width
		var bh=6;   //bracket height, past the edge of the wheel

		
		//pretend to be a mass:
		this.v=vt;
		this.w=(r+bh)*2;
		this.rest=rest;
		
		var txtOffs=r+14;
		
		var ptrans=0; //previous translation; helpful.
		
		//three layers, like the cylinder
		
		var back=canv.circle(x0-.001,y0-.001,r); //-.001 makes things line up better... maybe
		back.attr({fill:'#FFF',stroke:'none'});
		
		//the filled hemicircle
		var fill=canv.path(['M',x0+r*Math.dsin(-90),y0+r*Math.dcos(-90),
		                'a',r,r, 0, 0,0, 2*r,0,
		                'z']);
		
//		fill.attr({fill:'#E3E3E3','stroke-width':'.2'});
		fill.attr({fill:'#E3E3E3','stroke-width':'.2'});

		//fill.translate(x0,y0);
		//fill.rotate(90,x0,y0);
		
		var circle=canv.circle(x0-.001,y0-.001,r); //-.001 makes things line up better... maybe
		
		xOff=6;
		yOff=14;
		var lab=doLabel(label,[[0,-r-yOff],[0,r+yOff],
		                       [r+xOff,0],[-r-xOff,0],
		                       [0,-r/2,0],
		                       [r/2,0,0]],
		                      [x0,y0]);


		
		var stuff=canv.set(back,fill,circle,lab);
		
		var bt, ba; //bracket type, angle
		
		
		switch(bracket?bracket.toUpperCase():' '){
			case 'N': bt=1; ba=  0; break;
			case 'E': bt=1; ba= 90; break;
			case 'S': bt=1; ba=180; break;
			case 'W': bt=1; ba=270; break;
			case 'V': bt=2; ba=  0; break;
			case 'H': bt=2; ba= 90; break;
			default : bt=0; ba=  0; break;
		}
		
		if(bt){
			var brack;
			if(bt==1){
				brack=canv.path(['M',x0-bw/2,y0,
				                 'a',bw/2,bw/2,0,0,0,bw,0,
				                 'v',-(r+bh),
				                 'h',-bw,
				                 'z']);
				
			}else{
				brack=canv.path(['M',x0-bw/2,y0+r+bh,
				                 'h',bw,
				                 'v',-2*(r+bh),
				                 'h',-bw,
				                 'z']);
				
			}
			brack.attr({fill:'#FFF'});
			brack.rotate(ba,x0,y0);
			stuff.push(brack);
		}
		
		var center=canv.circle(x0-.01,y0-.01,1.25);
		center.attr({fill:'#000',stroke:'none'});
		stuff.push(center);
		
		this.update=function update(){
			var trans=(vt<0)?~vt:sys.Y[vt]*lScale;
			var rot=(vr<0)?~vr:sys.Y[vr]*rScale;
			
			stuff.translate(A.D.x*(trans-ptrans),A.D.y*(trans-ptrans));
			fill.rotate(rot,x0+A.D.x*(trans),y0+A.D.y*(trans));			
			
			ptrans=trans;
		}
		
		updaters.push(this);	
		this.update();	

	}
	
	////  mass-flow thermal systems  ////
	//vessel: a rectabgle with solid walls [texture?] filled with "water." 
			//Can have 4 walls, or 3 (no lid). If three walls, has "surface ripples."
	//pipe: carries "water" into, out of, or between tanks. Optional 'cut-off' ends would be cool.
	//mixer: a fan-shape on a shaft. Animate?
	
	var wallFill ='#E0E0E0';
	var waterFill='#EAEAFF';
	var waterStroke='#BBF';
	
	function Vessel(p,s,open,label){
		//p: [x,y] upper-left point
		//s: [w,h] size
		//open: open top? (closed by default)
		
		
		var wallW=8; //wall width
		
		var rippleW=6; //ripple spacing
		var rippleH=4; //ripple height
		
		p[0]-=.5;//make pixels happy
		p[1]-=.5;
		
		var fPath=[ //fluid path
			'M',p[0],p[1],
			'v',s[1],
			'h',s[0],
			'v',-s[1]];
		
		//var wPath;
		
		if(open){
			
			wPath=[
				'M',p[0],p[1]-wallW,
				'v',s[1]+wallW,
				'h',s[0],
				'v',-s[1]-wallW,
				'h',wallW,
				'v',s[1]+2*wallW,
				'h',-s[0]-2*wallW,
				'v',-s[1]-2*wallW,
				'z',];
				
			
			for(var i=s[0];(i-=rippleW)>=-rippleW;){
				fPath.push(['c',0,rippleH,
				               -rippleW,rippleH,
				               -rippleW,0]);
				
			}

		}else{
			
			wPath=[
				'M',p[0],p[1],
				'h',s[0],
				'v',s[1],
				'h',-s[0],
				'v',-s[1],
				'm',-wallW,-wallW,
				'v',s[1]+2*wallW,
				'h',s[0]+2*wallW,
				'v',-s[1]-2*wallW,
				'z',];
				
			fPath.push(['h',-s[0]]);
				
		}
		
		var water=canv.path(fPath).attr({fill:waterFill,stroke:waterStroke});
		var walls=canv.path(wPath).attr({fill:wallFill,'stroke-linecap':'square'});
		
		var offsX=5;
		var offsY=10;
		
		var lab=doLabel(label,[[0,-s[1]/2-wallW-offsY],
		                       [0, s[1]/2+wallW+offsY],
		                       [ s[0]/2+wallW+offsX,0],
		                       [-s[0]/2-wallW-offsX,0],
		                       [0,0,0],
		                       [0,0,0]],
		                      [p[0]+s[0]/2,p[1]+s[1]/2]);
	}
	
	//coss-section of a pipe segment
	function Pipe(p1,p2,w,label){
		
		w=w||8; //default to 8
		
		p1[0]-=.5; //please the pixel gods
		p1[1]-=.5;
		p2[0]-=.5;
		p2[1]-=.5;
		
		var l=Math.dist(p1,p2); //length
		var a=Math.angle(p1,p2);//angle
		
		var wW=2;//wall Width
		
		var sW=.45;//stroke width
		
				
		var water=canv.path([
			'M',p1[0]-1,p1[1]-w/2,
			'h',l+2,
			'v',w,
			'h',-l-2,
			'v',-w]).attr({stroke:'none',fill:waterFill}).rotate(a,p1[0],p1[1]);


		var walls=canv.path([
			'M',p1[0],p1[1]-w/2,
			'h',l,
			'v',-wW,
			'h',-l,
			'v',wW,
			'm',0,w,
			'h',l,
			'v',wW,
			'h',-l,
			'v',-wW]).attr({'stroke-width':sW,'stroke-linecap':'square',fill:wallFill}).rotate(a,p1[0],p1[1]);

		var offsX=5;
		var offsY=10;
		var lab=doLabel(label,[[0,-w/2-wW-offsY],
		                       [0, w/2+wW+offsY],
		                       [ w/2+wW+offsX,0],
		                       [-w/2-wW-offsX,0],
		                       [0,0,0],
		                       [0,0,0]],
		                      [(p1[0]+p2[0])/2,(p1[1]+p2[1])/2]);
	}
	
	function Mixer(p1,p2,w){
		
		w=w||16;
		
		var r=0;
		
		var dr=6; //degrees per frame
		
		p1[0]-=.5; //please the pixel gods
		p1[1]-=.5;
		p2[0]-=.5;
		p2[1]-=.5;
		
		var l=Math.dist(p1,p2); //length
		var a=Math.angle(p1,p2);//angle
		
		var pr=.6;//prop ratio
		
		var rOff=30;
		
		
		var shaft=canv.path(['M',p1[0],p1[1],
		                     'h',l]);
		                     
		                     
		var prop=canv.path();		
		
		
		shaft.attr({'stroke-width':'1.2'}).rotate(a,p1[0],p1[1]);
		prop .attr({fill:'#fff'})         .rotate(a,p1[0],p1[1]);
		
		
		this.update=function update(){
			prop.attr('path',['M',p1[0],p1[1],
		                    'c',-w*pr,-w*Math.dcos(r-rOff),
		                         w*pr,-w*Math.dcos(r+rOff),0,0,
		                    'c', w*pr, w*Math.dcos(r+rOff),
		                        -w*pr, w*Math.dcos(r-rOff),0,0]);
		   	r+=dr;
					
		}
		updaters.push(this);
		
		this.update();
		
	}
	
	
	function Motor(galv,vr,vi,p,s,dir){
		
		//vr //rotation
		//vi //current direction
		
		//var galv=true; //galvanometer; false for motor
		
		var c=p||[200,100];//center
		
		var height=s?s[1]:60;
		var width =s?s[0]:250;
		
		var aOff=0;
		
		dir=dir||0; //field direction S<-N if false, N->S if true
		
		var cRad=height/1.68;
		var wRad=cRad*2/11; //wire radius
		var padding=cRad/3; //between cRad and magnets
		var wPad=wRad/4; //between wires
		
		var bW=12;
		var bH=12;
		var bPad=.2;
		
		//terminals
		var t1=[0,0,0,0]; //1ax,1ay,1bx,1by  //inners
		var t2=[0,0,0,0]; //2ax,2ay,2bx,2by  //outers
		
		var nCirc=Math.floor((Math.PI*(cRad-wRad))/wRad);
		
		wRad=Math.PI*(cRad-wRad)/nCirc-wPad/2;
		
		var oRad=cRad+padding;
		
		c[0]-=.5;c[1]-=.5;
		
		var tA=Math.asin((height/2)/oRad);//angle
		var tOff=oRad*Math.cos(tA);       //offset
		
		var magnet=canv.path([
			'M',c[0]-width/2,c[1]-height/2,
			'h',width/2-tOff,
			'a',oRad,oRad,0,0,0, 0,height,
			'h',-width/2+tOff,
			'z',
			'M',c[0]+width/2,c[1]+height/2,
			'h',-width/2+tOff,
			'a',oRad,oRad,0,0,0, 0,-height,
			'h',+width/2-tOff,
			'z']).attr({'fill':'#CCC'});
		
		if(!galv){
			var brushes=canv.path(['M',c[0]-bW/2,c[1]-cRad-bH-bPad,'v', bH,'h', bW,'v',-bH,'z',
			                       'M',c[0]+bW/2,c[1]+cRad+bH+bPad,'v',-bH,'h',-bW,'v', bH,'z'])
				.attr({'fill':'#E0E0E0','stroke-width':'.8'});
			t1=[c[0],c[1]-cRad-bH/2-bPad,
			    c[0],c[1]+cRad+bH/2+bPad];
		}
		
		t2=[c[0],c[1]-height,c[0],c[1]+height];

		var iRad=cRad-2*wRad;
		
		var bg=canv.circle(c[0],c[1],iRad).attr({'stroke':'none','fill':'white'});
		
		var half=canv.path(['M',c[0]-iRad,c[1],
		                    'A',iRad,iRad,0,0,0,c[0]+iRad,c[1],
		                    'Z']).attr({fill:'#E3E3E3','stroke-width':.4});
		
		if(!galv)
			var cLineO=canv.circle(c[0],c[1],cRad).attr('stroke-width',.6);
		var cLineI=canv.circle(c[0],c[1],iRad).attr('stroke-width',.6);

		var labL=canv.text(c[0]-(oRad+width/2)/2,c[1],dir?'N':'S').attr(textAttribs);
		var labR=canv.text(c[0]+(oRad+width/2)/2,c[1],dir?'S':'N').attr(textAttribs);
		
		//draw the field
		var fSpacing=9;
		var aW=1.5,aL=3;
		for(var a=0;a<360;a+=fSpacing){
			
			var adir=(1-2*dir)*(1-2*((a+270)%360>180));
			
			if((Math.abs((a+90)%180-90)/180*Math.PI)<(tA)){
				canv.path(['M',c[0]+padding/3*(1-adir),c[1],
				           'h',(padding-padding/3)*adir,
				           'l',-aL*adir,aW,'m',aL*adir,-aW,'l',-aL*adir,-aW,]).translate(cRad+padding/6,0)
					.rotate(a,c[0],c[1]).attr({'stroke-width':.4});
			}
		}
		
		
		var terms=canv.path();
		
		
		var coil=canv.set();
		
		
		this.update=function update(){
			
			var aOff=(vr<0)?~v1:sys.Y[vr]*rScale/180*Math.PI;
			var curD=(vi<0)?~v2:sys.Y[vi];
			
			coil.remove();
			coil=canv.set();	
			
			half.rotate(aOff/Math.PI*180,c[0],c[1]);

			for(var i=0;i<nCirc;i++){
	
				if(!galv || (i+nCirc/8)%(nCirc/2)< nCirc/4 ){
	
					var a=i*2*Math.PI/nCirc+aOff;
					var r=cRad-wRad;
					
					if(galv&&(i+nCirc/8)%(nCirc/2)>nCirc/4-1){
						if(i>nCirc/2){
							t1[0]=c[0]+r*Math.cos(a);
							t1[1]=c[1]+r*Math.sin(a);
						}else{
							t1[2]=c[0]+r*Math.cos(a);
							t1[3]=c[1]+r*Math.sin(a);
						}
					}
					
					
					var cross=( (galv && (i+nCirc/4)%(nCirc)>nCirc/2) || (!galv && (a+Math.PI/2)%(Math.PI*2)>Math.PI));
					
					if(curD<0)
						cross=!cross;
					
					coil.push(canv.circle(c[0]+r*Math.cos(a),c[1]+r*Math.sin(a),wRad)
						.attr({'stroke-width':.8})); //,fill:'hsl('+i/nCirc+',1,1)'
					
					if(cross){
						var dR=Math.SQRT1_2*wRad; //diagonal radius
						coil.push(canv.path(['M', dR,-dR,'L',-dR, dR,
						                     'M',-dR,-dR,'L', dR, dR])
							.translate(c[0]+r*Math.cos(a),
						               c[1]+r*Math.sin(a))
							.attr({'stroke-width':.7}));
					}else{
						coil.push(canv.circle(c[0]+r*Math.cos(a),c[1]+r*Math.sin(a),.7)
							.attr({'stroke':'none',fill:'black'}));
					}
				}
			}
			
			
			terms.attr({path:['M',t1[0],t1[1]-wRad,'C',t1[0],t1[1]-height/3,t2[0],t2[1]+height/3,t2[0],t2[1],
			                  'M',t1[2],t1[3]+wRad,'C',t1[2],t1[3]+height/3,t2[2],t2[3]-height/3,t2[2],t2[3]]});
			
			
			
			aOff=(aOff+1.8/180*Math.PI)%(Math.PI*2);
			
			
		}
		
		updaters.push(this);	
		this.update();
		
		
	}
	
	
	function Speaker(vm,vb,vi,p,s,angle,dir){
		
		//var c=[200,250];
		var c=p;
		
		c[0]-=.5;c[1]-=.5;
		
		// three values:
		//    vb - Base position
		//    vc - Coil Position
		//    vi - current direction
		//in most cases, one of vb,vc will be static (negative), and the other dynamic (index).
		//
		
		//var angle=180;
		
		//var vm=-1,vb=0,vi=1;
		
		var w=s[0];
		var h=s[1];
		
		
		//var w=200;
		//var h=180;
		var oWall=w/6;
		var iWall=w/10;
		
		var cH=h/5*2; //coil height
		var cW=w/5;
		
		var wR=cH/2/5;//wire radius
		
		var vOff=h/2.5; //vertical offset (distance from base to magnet)
		var oW=2;     //cone Width
		var bH=h/8;   //base height
		
		//dir=dir?1:-1;
		angle=angle||0;//default to 0
		
		var p1=0; //first //for connecting wires
		var p2=0; //last
		
					
		var bOff=0,cOff=0,curD=0;
		var pbOff=0,pmOff=0,pcurD=0;
		
		var magnet=canv.path(['M',-w/2,-h/2,'h',w,'v',h,'h',-cW,'v',-cH,'h',cW-oWall,
		                      'v',-(h-oWall-cH),'h',-(w-2*oWall-iWall)/2,'v',(h-oWall-cH),
		                      'h',(cW-iWall)/2,'v',cH,'h',-cW,'v',-cH,'h',(cW-iWall)/2,
		                      'v',-(h-oWall-cH),'h',-(w-2*oWall-iWall)/2,'v',(h-oWall-cH),
		                      'h',cW-oWall,'v',cH,'h',-cW,'v',-h])
			.translate(c[0],c[1])
			.attr({'fill':'#CCC'});
		
		var wOff=(w-cW)/4;
		
		var wires=canv.set();
		
		var base=canv.path(['M',-w/2,h/2+vOff,
		                    'h',w/2-wOff+wR,
		                    'v',-(vOff+cH),
		                    'h',oW,
		                    'v', (vOff+cH),
		                    'h',wOff*2-oW*2-wR*2,
		                    'v',-(vOff+cH),
		                    'h',oW,
		                    'v', (vOff+cH),
		                    'h',w/2-wOff+wR,
		                    'v',bH,
		                    'h',-w,
		                    'z'])
			.translate(c[0],c[1]);
		

		var lY=h/2-cH/2; //label Y

		var labs=canv.set(canv.text(c[0]+Math.dsin(-angle)*lY+Math.dcos(-angle)*(-w/2+cW/2),c[1]+Math.dcos(angle)*lY+Math.dsin(angle)*(-w/2+cW/2),dir?'S':'N').attr(textAttribs),
		                  canv.text(c[0]+Math.dsin(-angle)*lY                              ,c[1]+Math.dcos(angle)*lY                             ,dir?'N':'S').attr(textAttribs),
		                  canv.text(c[0]+Math.dsin(-angle)*lY+Math.dcos(-angle)*( w/2-cW/2),c[1]+Math.dcos(angle)*lY+Math.dsin(angle)*( w/2-cW/2),dir?'S':'N').attr(textAttribs));
		
		magnet.rotate(angle,c[0],c[1]);
		
		var magSet=canv.set(magnet,labs);
		
		base.rotate(angle,c[0],c[1]); 
		
		
		var axL=theDiagram.axis([c[0]+Math.dcos(-angle)*(-w/2+cW/2)+Math.dsin(-angle)*(h/2),c[1]+Math.dcos(angle)*(h/2)+Math.dsin(angle)*(-w/2+cW/2)],angle+90);
		theDiagram.spring('',axL,theDiagram.mass(vm,'',axL,0,0,0,0),theDiagram.mass(vb,'',axL,vOff,0,0,0));

		var axR=theDiagram.axis([c[0]+Math.dcos(-angle)*( w/2-cW/2)+Math.dsin(-angle)*(h/2),c[1]+Math.dcos(angle)*(h/2)+Math.dsin(angle)*( w/2-cW/2)],angle+90);
		theDiagram.dash('',axR,theDiagram.mass(vm,'',axL,0,0,0,0),theDiagram.mass(vb,'',axL,vOff,0,0,0));
		
		
		
		var conWires=canv.path('M0,0').attr({'stroke-width':.5});
		//WC=0; //wire-count
				
		var first=1; //first update?	
				
		this.update=function update(){
			

			var bOff=(vb<0)?~vb:sys.Y[vb]*lScale;
			var mOff=(vm<0)?~vm:sys.Y[vm]*lScale;
			var curD=(vi<0)?~vi:sys.Y[vi];
			
			curD=curD>0?1:-1;
			
			base.   translate(Math.dsin(-angle)*(bOff-pbOff),Math.dcos(angle)*(bOff-pbOff));
			magSet. translate(Math.dsin(-angle)*(mOff-pmOff),Math.dcos(angle)*(mOff-pmOff));
			

			
			if(curD==pcurD && wires.length && (bOff-pbOff)){//if current hasn't changed, wires exist, and the base (and wires) have moved.
				wires.translate(Math.dsin(-angle)*(bOff-pbOff),
				                Math.dcos( angle)*(bOff-pbOff));
				//p1+=(bOff-pbOff);
				//p2+=(bOff-pbOff);
				
			}else{
				
				//WC++;
				
				wires.remove();
				
				//WIRES=wires;
								
				wires=canv.set();
				
				var curD=-1+2*(curD>0);

			    //p1=0;p2=0;
				
				for(var i=wR;i<=cH-wR;i+=wR*2){
					
					var dR=Math.SQRT1_2*wR; //diagonal radius
					
					if(first){
						p2=c[1]+h/2-i;
						
						if(p1==0)
							p1=p2;
							
					}
					
					
					wires.push(canv.circle(c[0]-wOff,c[1]+h/2-i,wR).attr({'stroke-width':'.8'}),
					           canv.circle(c[0]+wOff,c[1]+h/2-i,wR).attr({'stroke-width':'.8'}),
		
					           canv.circle(c[0]+wOff*curD,c[1]+h/2-i,.7).attr({'stroke':'none',fill:'black'}),
					
					canv.path(['M',c[0]-wOff*curD,c[1]+h/2-i,
					           'm',-dR,-dR,
					           'l',dR*2,dR*2,
					           'm',0,-dR*2,
					           'l',-dR*2,dR*2])
						.attr({'stroke-width':'.7'}));
		
				}
				
				wires.translate(0,bOff);
				wires.rotate(angle,c[0],c[1]);
				

			}
			
			p1+=(bOff-pbOff);
			p2+=(bOff-pbOff);
	
			if(pbOff!=bOff || first){
			conWires.attr({path:['M',c[0]-wOff-wR,p1,'h',-wR/2,'V',c[1]+h/2+vOff+2*bH/3+bOff,'H',c[0]+w/2,
			                      'c',40,0, 10,-(h/2+vOff+2*bH/3+bOff)+25, 50,-(h/2+vOff+2*bH/3+bOff)+25,
			                     'M',c[0]+wOff+wR,p2,'h', wR/2,'V',c[1]+h/2+vOff+1*bH/3+bOff,'H',c[0]+w/2,
			                      'c',40,0, 10,-(h/2+vOff+1*bH/3+bOff)-25, 50,-(h/2+vOff+1*bH/3+bOff)-25]})
			        .rotate(angle,c[0],c[1]);
			}
			

			
			pbOff=bOff;
			pmOff=mOff;
			pcurD=curD;
			
			first=0;
	
		}
		
		updaters.push(this);
		this.update();
		
	}
	
}

Math.amod=function(n,m){ //absolute mod (n%m) (wraps negative numbers into a positive range)
	return (n%m+m)%m-m; //there MUST be a more efficient way of doing this.
}

//sin and cos for degree angles
Math.dsin=function(a){ return Math.sin(a/180*Math.PI) }
Math.dcos=function(a){ return Math.cos(a/180*Math.PI) }

//vector functions take points on the form [x,y]
Math.dist=function(p1,p2){
	return Math.sqrt((p2[0]-p1[0])*(p2[0]-p1[0])+(p2[1]-p1[1])*(p2[1]-p1[1]));
}
Math.angle=function(p1,p2){
	return Math.atan2((p2[1]-p1[1]),(p2[0]-p1[0]))/Math.PI*180;
}

