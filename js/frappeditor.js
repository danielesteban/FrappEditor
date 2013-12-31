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
		this.ace.getSession().setUseSoftTabs(false);
		this.ace.on('change', function() {
			EDITOR.unsaved = true;
			$('footer .status').text(L.notSaved + (EDITOR.file ? ': ' + EDITOR.file.name : ''));
		});

		$('.modal#open').on('show.bs.modal', function() {
			var modal = $(this);
			EDITOR.renderFileList(EDITOR.file ? EDITOR.file.path : null, $('.fileList', modal), {
				fileClick : function(file) {
					EDITOR.open(file);
					modal.modal('hide');
				}
			});
		});

		$('.modal#newItem').on('shown.bs.modal', function() {
			$('input', $(this)).first().focus();
		});

		$('.modal#newItem form').submit(function(e) {
			e.stopPropagation();
			e.preventDefault();
			var modal = $(this).parents('.modal').first(),
				name = e.target.name.value;
			
			if(name === '') return;
			switch(e.target.type.value) {
				case 'directory':
					FRAPP.mkdir(EDITOR.path, name, function() {
						EDITOR.updateTree(EDITOR.path);
						modal.modal('hide');
					});
				break;
				case 'file':
					EDITOR.file = {
						path : EDITOR.path,
						name : name
					};
					EDITOR.save(function() {
						EDITOR.open(EDITOR.file);
						modal.modal('hide');
					});
				break;
				case 'rename':
					var path = e.target.path.value,
						oldName = e.target.oldName.value;

					FRAPP.rename(path, oldName, name, function() {
						EDITOR.file && EDITOR.file.path === path && EDITOR.file.name === oldName && (EDITOR.file.name = name) && EDITOR.open(EDITOR.file);
						EDITOR.updateTree(EDITOR.path);
						modal.modal('hide');
					});
				break;
			}
		});

		EDITOR.updateTree(params.path);
	},
	updateTree : function(path, open) {
		EDITOR.renderFileList(path, $('nav'), {
			fileClick : EDITOR.open.bind(EDITOR),
			dirClick : function(item) {
				EDITOR.path = item.fullName;
			},
			contextmenu : function(e, item) {
				if(item.name === '..') return;
				FRAPP.contextmenu(e, [
					{
						label : L.rename,
						click : function() {
							var modal = $('.modal#newItem');
							$('#newItemLabel', modal).text(L.rename);
							$('form', modal)[0].reset();
							$('input[name="type"]', modal).val('rename');
							$('input[name="path"]', modal).val(item.path);
							$('input[name="name"], input[name="oldName"]', modal).val(item.name);
							modal.modal('show');
						}
					},
					{
						label : L.remove,
						click : function() {
							if(!confirm(L.areYouSure)) return;
							var cb = function() {
									$(e.target).parents('li').first().fadeOut('fast');
								};

							if(item.type === 'directory') FRAPP.rmdir(item.fullName, cb);
							else {
								FRAPP.unlink(item.path, item.name, cb);
								EDITOR.file && EDITOR.file.path === item.path && EDITOR.file.name === item.name && EDITOR.newFile(true);
							}
						}
					}
				]);
			}
		});
		EDITOR.path = path;
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
	renderFileList : function(path, container, events) {
		var self = this;
		this.listDirectory(path, function(items) {
			var getItem = function(e) {
					return items[$(e.target).parents('li').first().index()];
				};

			self.file && items.forEach(function(i) {
				i.path === self.file.path && i.name === self.file.name && (i.active = true);
			});
			container.empty().append(Handlebars.partials.fileList(items));
			$('a', container).click(function(e) {
				var item = getItem(e);
				if(item.type === 'directory') {
					events.dirClick && events.dirClick(item);
					EDITOR.renderFileList(item.fullName, container, events);
				} else if(events.fileClick) events.fileClick(item);
			}).bind('contextmenu', function(e) {
				var item = getItem(e);
				events.contextmenu && events.contextmenu(e, item);
			});
		});
	},
	open : function(file) {
		var modelist = ace.require('ace/ext/modelist'),
			editor = this.ace;

		if(EDITOR.unsaved && !confirm(L.unsavedConfirmation)) return;
		this.file = file;
		this.updateTree(file.path);
		FRAPP.readFile(file.path, file.name, function(contents) {
			editor.setValue(contents);
			editor.clearSelection();
			editor.gotoLine(0);
			editor.session.setMode(modelist.getModeForPath(file.name).mode);
			$('footer .status').text(L.editing + ': ' + file.name);
			FRAPP.setTitle(file.name + ' ─ ' + file.path);
			delete EDITOR.unsaved;
		});
	},
	save : function(callback) {
		if(EDITOR.saving) return;
		if(!this.file) return this.saveAs();
		var file = this.file;
		EDITOR.saving = true;
		FRAPP.saveFile(file.path, file.name, this.ace.getValue(), function() {
			$('footer .status').text(L.saved + ': ' + file.name);
			delete EDITOR.unsaved;
			delete EDITOR.saving;
			callback && callback();
		});
	},
	saveAs : function() {
		var modal = $('.modal#newItem');
		$('#newItemLabel', modal).text(L.saveAs + '...');
		$('form', modal)[0].reset();
		$('input[name="type"]', modal).val('file');
		modal.modal('show');
	},
	newFile : function(force) {
		if(!force && EDITOR.unsaved && !confirm(L.unsavedConfirmation)) return;
		delete this.file;
		this.ace.setValue('');
		$('footer .status').text('');
	},
	newFolder : function() {
		var modal = $('.modal#newItem');
		$('#newItemLabel', modal).text(L.newFolder);
		$('form', modal)[0].reset();
		$('input[name="type"]', modal).val('directory');
		modal.modal('show');
	},
	setTheme : function(name) {
		FRAPP.storage.set('theme', name, true);
		this.ace.setTheme('ace/theme/' + name);
	},
	showSearch : function(replace) {
		ace.require('ace/ext/searchbox').Search(this.ace, replace);
	},
	newWindow : function() {
		FRAPP.load({
			repository : {
				type : 'git',
				url : 'https://github.com/danielesteban/FrappEditor.git'
			}
		}, {path : EDITOR.path});
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
		(e.metaKey || e.ctrlKey) && e.keyCode === 78 && EDITOR.newFile();
		(e.metaKey || e.ctrlKey) && e.altKey && (e.keyCode === 78 || e.keyCode === 192) && EDITOR.newFolder();
		(e.metaKey || e.ctrlKey) && e.shiftKey && e.keyCode === 78 && EDITOR.newWindow();
		(e.metaKey || e.ctrlKey) && e.keyCode === 83 && EDITOR.save();
		(e.metaKey || e.ctrlKey) && e.altKey && e.keyCode === 83 && EDITOR.saveAs();
		(e.metaKey || e.ctrlKey) && e.keyCode === 79 && $('.modal#open').modal('show');
	});

	/* Init editor */
	EDITOR.init(e.detail.params || null);
});
