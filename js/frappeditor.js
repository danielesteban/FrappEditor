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
	init : function(frapp) {
		var themelist = ace.require('ace/ext/themelist').themesByName;
		$('body').append(Handlebars.templates.editor({
			themes : themelist,
			version : FRAPP.version.frapp,
			year : (new Date()).getFullYear()
		}));

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
					FRAPP.mkdir(e.target.path.value, name, function() {
						EDITOR.renderTree();
						modal.modal('hide');
					});
				break;
				case 'file':
					rename();
					EDITOR.save(function() {
						EDITOR.renderTree();
						modal.modal('hide');
					});
				break;
				case 'rename':
					var path = e.target.path.value,
						oldName = e.target.oldName.value;

					FRAPP.rename(path, oldName, name, function() {
						EDITOR.file && EDITOR.file.path === path && EDITOR.file.name === oldName && rename();
						EDITOR.renderTree();
						modal.modal('hide');
					});
				break;
			}
		});

		EDITOR.frapp = frapp;
		FRAPP.setTitle('FrappEditor' + ' ─ ' + frapp.path);
		EDITOR.renderTree(frapp.path);
	},
	updateTree : function() {
		$('nav li').removeClass('active');
		if(!this.file) return;
		$('nav li.' + this.file.id).addClass('active');
	},
	renderTree : function(path, tree, level) {
		var self = this;
		path = path || EDITOR.frapp.path;
		tree = tree || $('nav');
		level = level || 1;
		FRAPP.listDirectory(path, function(data) {
			var ignore = ['.DS_Store', '.git'],
				items = [],
				directories = [],
				files = [];

			tree.empty();
			data.forEach(function(item) {
				ignore.indexOf(item.name) === -1 && items.push(item);
			});
			items.forEach(function(item) {
				var li = $('<li>'),
					a = $('<a style="padding-left:' + (level * 10) + 'px">');

				li.attr('class', LIB.fileId(item));
				item.name = $('<div>').html(item.name).text();
				a.html((item.type === 'directory' ? '<small class="glyphicon glyphicon-chevron-right"></small> ' : '') + item.name);
				a.mousedown(LIB.cancelHandler).bind('contextmenu', function(e) {
					if(item.name === '..') return;
					var menu = [
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
										li.first().fadeOut('fast', function() {
											self.renderTree(path, tree, level);
										});
									};

								if(item.type === 'directory') FRAPP.rmdir(item.fullName, cb);
								else {
									FRAPP.unlink(item.path, item.name, cb);
									EDITOR.file && EDITOR.file.path === item.path && EDITOR.file.name === item.name && EDITOR.close();
								}
							}
						}
					];
					item.type === 'directory' && (menu = [
						{
							label : L.newFile,
							click : function() {
								self.newFile(item.fullName);
							}	
						},
						{
							label : L.newFolder,
							click : function() {
								self.newFolder(item.fullName);
							}	
						}
					].concat(menu));
					FRAPP.contextmenu(e, menu);
				});
				li.append(a);
				if(item.type === 'directory') {
					var ul, icon;
					a.click(function() {
						if(!ul) {
							ul = $('<ul class="nav nav-pills nav-stacked">');
							if(li.next().length) li.next().before(ul);
							else li.parent().append(ul);
							icon = $('.glyphicon', ul.prev());
							self.renderTree(item.fullName, ul, level + 1);
						} else ul[ul.is(':visible') ? 'hide' : 'show']();
						icon.attr('class', 'glyphicon glyphicon-chevron-' + (icon.hasClass('glyphicon-chevron-right') ? 'down' : 'right'));
					});
					directories.push(li);
				} else {
					a.click(function() {
						EDITOR.open(item);
					});
					files.push(li);
				}
			});
			directories.concat(files).forEach(function(li) {
				tree.append(li);
			});
			self.updateTree();
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
				FRAPP.setTitle((file.name ? file.name : L.newFile) + ' ─ ' + file.path);
				self.updateTree();
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
		delete file.unsaved;
		$('#tabs #tab' + file.id).remove();
		$('#editor #editor' + file.id).remove();
		if(this.file.id !== file.id) return;
		delete this.file;
		$('footer .status').text('');
		FRAPP.setTitle('FrappEditor');
		this.updateTree();
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
	newFile : function(path) {
		this.open({
			path : path || (this.file ? this.file.path : EDITOR.frapp.path)
		});
	},
	newFolder : function(path) {
		var modal = $('.modal#newItem');
		$('#newItemLabel', modal).text(L.newFolder);
		$('form', modal)[0].reset();
		$('input[name="type"]', modal).val('directory');
		$('input[name="path"]', modal).val(path || (this.file ? this.file.path : EDITOR.frapp.path));
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
		});
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
		if((e.metaKey || e.ctrlKey) && e.keyCode === 87) {
			LIB.cancelHandler(e);
			EDITOR.close();
		}
	});

	/* Init editor */
	if(e.detail.params && e.detail.params.frapp) return EDITOR.init(e.detail.params.frapp);
	
	/* Open modal */
	FRAPP.installed(function(data) {
		var engineFrapps = [
				'https://github.com/danielesteban/FrappInstaller.git',
				'https://github.com/danielesteban/FrappSignin.git',
				'https://github.com/danielesteban/FrappMenu.git'
			],
			frapps = [];
		
		data.forEach(function(f) {
			engineFrapps.indexOf(f.repository.url) === -1 && frapps.push(f);
		});
		
		var modal = $(Handlebars.partials.open({
			frapps : frapps
		}));
		modal.on('hidden.bs.modal', function() {
			$(this).remove();
		});
		$('td', modal).click(function(e) {
			EDITOR.init(frapps[$(e.target).parents('tr').first().index()]);
			modal.modal('hide');
		});
		$('body').append(modal);
		modal.modal({backdrop : 'static', keyboard : false});
	});
});
