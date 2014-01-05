LIB = {
	arraySearch : function(haystack, needle, index, returnIndex) {		
		try {
			haystack.forEach(function(item, i) {
				if(item && item[index] === needle) {
					throw returnIndex ? parseInt(i, 10) : item;
				}
			});
		} catch(r) {
			return r;
		}
		return false;
	},
	fileId : function(file) {
		var escape = function(str) {
				return str.replace(/\\/g, '_').replace(/\//g, '_').replace(/\./g, '_');
			};

		return file.name ? escape(file.path) + '_' + escape(file.name) : (new Date()).getTime();
	},
	cancelHandler : function(e) {
		e.stopPropagation();
		e.preventDefault();
	}
};

EDITOR = {
	init : function(params) {
		var themelist = ace.require('ace/ext/themelist').themesByName;
		$('body').append(Handlebars.templates.editor({
			themes : themelist,
			version : FRAPP.version.frapp,
			year : (new Date()).getFullYear()
		}));
		
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
			var modal = $(this).parents('.modal').first(),
				name = e.target.name.value,
				rename = function() {
					var file = EDITOR.file,
						tab = $('#tabs #tab' + file.id),
						editor = $('#editor #editor' + file.id),
						a = $('#tabs #tab' + file.id + ' a')[0];

					a.removeChild(a.firstChild);
					a.insertBefore(document.createTextNode(name), a.firstChild);
					file.name = name;
					file.id = LIB.fileId(file);
					tab.attr('id', 'tab' + file.id);
					editor.attr('id', 'editor' + file.id);
					EDITOR.open(file);
					file.editor.getSession().setMode(ace.require('ace/ext/modelist').getModeForPath(file.name).mode);
				};
			
			LIB.cancelHandler(e);
			if(name === '') return;
			switch(e.target.type.value) {
				case 'directory':
					FRAPP.mkdir(EDITOR.path, name, function() {
						EDITOR.updateTree(EDITOR.path);
						modal.modal('hide');
					});
				break;
				case 'file':
					EDITOR.file.path = EDITOR.path || '.';
					rename();
					EDITOR.save(function() {
						EDITOR.updateTree(EDITOR.path);
						modal.modal('hide');
					});
				break;
				case 'rename':
					var path = e.target.path.value,
						oldName = e.target.oldName.value;

					FRAPP.rename(path, oldName, name, function() {
						EDITOR.file && EDITOR.file.path === path && EDITOR.file.name === oldName && rename();
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
								EDITOR.file && EDITOR.file.path === item.path && EDITOR.file.name === item.name && EDITOR.close();
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
			var ignore = ['.DS_Store', '.git'],
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
		!(file.id) && (file.id = LIB.fileId(file));
		if(this.file && this.file.id === file.id) return;
		!this.files && (this.files = []);
		
		var self = this,
			container = $('#editor'),
			tabs = $('#tabs'),
			already = LIB.arraySearch(this.files, file.id, 'id'),
			render = function(contents) {
				var li = $('<li id="tab' + file.id + '"><a></a></li>'),
					div = $('<div id="editor' + file.id + '" class="editor" style="display:none"></div>'),
					editor = ace.edit(div[0]),
					modelist = ace.require('ace/ext/modelist'),
					session = ace.createEditSession(contents, file.name ? modelist.getModeForPath(file.name).mode : 'ace/mode/javascript');
				
				session.setUseWrapMode(true);
				session.setUseSoftTabs(false);
				editor.setTheme('ace/theme/' + (FRAPP.storage.get('theme', true) || 'twilight'));
				editor.setSession(session);
				editor.on('change', function() {
					file.unsaved = true;
					li.addClass('unsaved');
					$('footer .status').text(L.notSaved + (file.name ? ': ' + file.name : ''));
				});
				file.editor = editor;
				$('a', li).text(file.name || L.newFile).click(function() {
					self.open(file);
				}).append($('<span>&times;</span>').click(function() {
					self.close(file);
				}));
				tabs.append(li);
				container.append(div);
				self.files.push(self.file = file);
				show();
			},
			show = function() {
				container.children().hide();
				$('#editor' + file.id, container).show();
				tabs.children().removeClass('active');
				$('#tab' + file.id, tabs).addClass('active');
				$('footer .status').text(file.name ? L.editing + (file.name ? ': ' + file.name : '') : L.newFile);
				FRAPP.setTitle(file.name ? file.name + ' ─ ' + file.path : L.newFile);
				self.updateTree(file.path || self.path);
				file.editor.focus();
			};

		if(already) {
			this.file = file = already;
			return show();
		}
		if(!file.name) return render('');
		FRAPP.readFile(file.path, file.name, render);
	},
	close : function(file) {
		file = file || this.file;
		if(!file) return window.close();
		if(file.unsaved && !confirm(L.unsavedConfirmation)) return;
		var index = LIB.arraySearch(this.files, file.id, 'id', true);
		this.files[index].editor.destroy();
		this.files.splice(index, 1);
		$('#tabs #tab' + file.id).remove();
		$('#editor #editor' + file.id).remove();
		if(this.file.id !== file.id) return;
		delete this.file;
		$('footer .status').text('');
		FRAPP.setTitle('FrappEditor');
		this.updateTree(this.path);
		this.files.length && this.open(this.files[index - (index > 0 ? 1 : 0)]);
	},
	save : function(callback) {
		if(!this.file || this.saving) return;
		if(!this.file.name) return this.saveAs();
		var file = this.file,
			self = this;
		
		this.saving = true;
		FRAPP.saveFile(file.path, file.name, file.editor.getValue(), function() {
			delete self.file.unsaved;
			delete self.saving;
			$('footer .status').text(L.saved + ': ' + file.name);
			$('#tabs #tab' + file.id).removeClass('unsaved');
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
	newFile : function() {
		this.open({});
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
		if(!this.files) return;
		this.files.forEach(function(f) {
			f.editor.setTheme('ace/theme/' + name);
		});
	},
	showSearch : function(replace) {
		if(!this.file) return;
		ace.require('ace/ext/searchbox').Search(this.file.editor, replace);
	},
	newWindow : function() {
		FRAPP.load({
			repository : {
				type : 'git',
				url : 'https://github.com/danielesteban/FrappEditor.git'
			}
		}, {path : EDITOR.path});
	},
	undo : function() {
		this.file && this.file.editor.undo();
	},
	redo : function() {
		this.file && this.file.editor.redo();
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
		if((e.metaKey || e.ctrlKey) && e.altKey && (e.keyCode === 78 || e.keyCode === 192)) return EDITOR.newFolder();
		if((e.metaKey || e.ctrlKey) && e.shiftKey && e.keyCode === 78) return EDITOR.newWindow();
		(e.metaKey || e.ctrlKey) && e.keyCode === 78 && EDITOR.newFile();
		if((e.metaKey || e.ctrlKey) && e.altKey && e.keyCode === 83) return EDITOR.saveAs();
		(e.metaKey || e.ctrlKey) && e.keyCode === 83 && EDITOR.save();
		(e.metaKey || e.ctrlKey) && e.keyCode === 79 && $('.modal#open').modal('show');
		if((e.metaKey || e.ctrlKey) && e.keyCode === 87) {
			LIB.cancelHandler(e);
			EDITOR.close();
		}
	});

	/* Init editor */
	EDITOR.init(e.detail.params || null);
});
