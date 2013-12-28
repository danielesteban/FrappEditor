EDITOR = {
	init : function(params) {
		var themelist = ace.require('ace/ext/themelist').themesByName;
		$('body').append(Handlebars.templates.editor({
			themes : themelist,
			version : FRAPP.version.frapp,
			year : (new Date()).getFullYear()
		}));
		this.ace = ace.edit('editor');
		this.setTheme(FRAPP.storage.get('theme', true) || 'twilight');
		this.ace.getSession().setMode('ace/mode/javascript');
		this.ace.getSession().setUseWrapMode(true);
		this.ace.on('change', function() {
			EDITOR.unsaved = true;
			$('footer .status').text(L.notSaved + (EDITOR.file ? ': ' + EDITOR.file.name : ''));
		});

		$('.modal#open').on('show.bs.modal', function() {
			var modal = $(this);
			EDITOR.renderFileList(EDITOR.file ? EDITOR.file.path : null, $('.fileList', modal), function(file) {
				EDITOR.open(file);
				modal.modal('hide');
			});
		});

		EDITOR.updateTree(params.path);
	},
	updateTree : function(path, open) {
		EDITOR.renderFileList(path, $('nav'), EDITOR.open.bind(EDITOR));
	},
	listDirectory : function(path, callback) {
		FRAPP.listDirectory(path, function(data) {
			var ignore = ['.DS_Store'],
				items = [];

			data.forEach(function(item) {
				ignore.indexOf(item.name) === -1 && items.push(item);
			});
			callback(items);
		});
	},
	renderFileList : function(path, container, onFileClick) {
		var self = this;
		this.listDirectory(path, function(items) {
			self.file && items.forEach(function(i) {
				i.path === self.file.path && i.name === self.file.name && (i.active = true);
			});
			container.empty().append(Handlebars.partials.fileList(items));
			$('a', container).click(function(e) {
				var item = items[$(e.target).parents('li').first().index()];
				if(item.type === 'directory') EDITOR.renderFileList(item.fullName, container, onFileClick);
				else if(onFileClick) onFileClick(item);
			});
		});
	},
	open : function(file) {
		var modelist = ace.require('ace/ext/modelist'),
			editor = this.ace;

		if(EDITOR.unsaved && !confirm(L.unsavedConfirmation)) return;
		this.file = file;
		this.updateTree(file.path);
		FRAPP.readFile(file.fullName, function(contents) {
			editor.setValue(contents);
			editor.clearSelection();
			editor.gotoLine(0);
			editor.session.setMode(modelist.getModeForPath(file.name).mode);
			$('footer .status').text(L.editing + ': ' + file.name);
			FRAPP.setTitle(file.name + ' ─ ' + file.path);
			delete EDITOR.unsaved;
		});
	},
	save : function() {
		if(EDITOR.saving || !this.file) return; //TODO: New file!
		var file = this.file;
		EDITOR.saving = true;
		FRAPP.saveFile(file.fullName, this.ace.getValue(), function() {
			$('footer .status').text(L.saved + ': ' + file.name);
			delete EDITOR.unsaved;
			delete EDITOR.saving;
		});
	},
	saveAs : function() {
		//TODO!
	},
	new : function() {
		//TODO!
	},
	setTheme : function(name) {
		FRAPP.storage.set('theme', name, true);
		this.ace.setTheme('ace/theme/' + name);
	},
	showSearch : function(replace) {
		ace.require('ace/ext/searchbox').Search(this.ace, replace);
	}
}

window.addEventListener('frapp.init', function(e) {	
	/* Handlebars helpers */
	Handlebars.registerHelper('equals', function(val1, val2, options) {
		if(val1 === val2) return options.fn(this);
		else return options.inverse(this);
	});

	Handlebars.registerHelper('i', function(className) {
		return new Handlebars.SafeString('<span class="glyphicon glyphicon-' + className + '"></span>');
	});

	/* Keyboard shorcuts */
	$(window).keydown(function(e) {
		(e.metaKey || e.ctrlKey) && e.keyCode === 78 && EDITOR.new();
		(e.metaKey || e.ctrlKey) && e.keyCode === 83 && EDITOR.save();
		(e.metaKey || e.ctrlKey) && e.altKey && e.keyCode === 83 && EDITOR.saveAs();
		(e.metaKey || e.ctrlKey) && e.keyCode === 79 && $('.modal#open').modal('show');
	});

	/* Init editor */
	EDITOR.init(e.detail.params || null);
});
