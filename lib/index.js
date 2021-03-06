"use strict";

const BloggifyAdapter = require("bloggify-adapter")
    , mdify = require("mdify")
    , ul = require("ul")
    , sameTime = require("same-time")
    , bindy = require("bindy")
    , fs = require("fs")
    , slugify = require("slugly")
    , mkdirp = require("mkdirp")
    , path = require("path")
    , mapO = require("map-o")
    ;

module.exports = class BloggifyMarkdownAdapter extends BloggifyAdapter {
    static init (config) {
        Bloggify.adapter = new BloggifyMarkdownAdapter(config)
        return Bloggify.adapter._theme
    }

    constructor (options) {
        super(options);
        mapO(this.options.paths, val => path.resolve(Bloggify.options.root, val))
        this.paths = this.options.paths

        mkdirp.sync(this.paths.articles);
        mkdirp.sync(this.paths.pages);

        fs.watch(this.paths.articles, this._refreshCache.bind(this));
        Bloggify.on("ready", () => {
            this._refreshCache();
        });
        this.parseOpts = this.parse = this.options.parse
    }

    _refreshCache () {
        this.bloggify.log("Refreshing the content cache.");
        this.cache = {
            articles: {}
          , pages: {}
          , articleIds: null
          , pageSlugs: null
          , articles_list: null
          , pages_list: null
        };
        this.getArticleIds((err, ids) => {
            if (err) { return this.bloggify.log(err); }
            this.cache.articleIds = ids;
            this.getArticles({
                ids: ids
            }, (err, articles) => {
                if (err) { return this.bloggify.log(err); }
                this.cache.articles_list = articles;
                this.cache.articles = {};
                articles.forEach(c => this.cache.articles[c.id] = c);
            });
        });
        this.getAllPageSlugs((err, slugs) => {
            if (err) { return this.bloggify.log(err); }
            this.cache.pageSlugs = slugs;
            this.getPages((err, pages) => {
                if (err) { return this.bloggify.log(err); }
                this.pages_list = pages;
                this.pages = {};
                pages.forEach(c => this.pages[c.slug] = c);
            });
        });
    }

    getArticlePath (id) {
        return `${this.paths.articles}/${id}.md`;
    }

    getPagePath (slug) {
        return `${this.paths.pages}/${slug}.md`;
    }

    getArticleById (id, cb) {
        if (this.cache.articles[id]) {
            return cb(null, this.cache.articles[id]);
        }
        mdify.parseFile(this.getArticlePath(id), this.parseOpts, (err, data) => {
            if (err) { return cb(err); }
            data.id = id;
            data.slug = data.metadata.slug || slugify(data.metadata.title, { lower: true });
            data.path = `${this.options.routes.articles}/${data.id}${data.slug ? "-" + data.slug : ""}`;
            data.content = data.markdown;
            data.summary_html = data.html.split("\n").slice(0, this.options.display.html_summary_paragraphs).join("\n")
            data.image = data.metadata.image || (data.markdown.match(/!\[.*\]\((.*)\)/m) || [])[1] || ""
            data.description = data.metadata.description || data.html.split("\n")[0].replace(/(<([^>]+)>)/ig, "")
            cb(null, data);
        });
    }

    getArticleIds (cb) {
        if (this.cache.articleIds) {
            return cb(null, this.cache.articleIds);
        }
        fs.readdir(this.paths.articles, (err, articles) => {
            if (err) { return cb(err); }
            let allIds = articles.map(c => parseInt(c)).filter(Boolean).sort((a, b) => a < b ? -1 : 1);
            cb(null, allIds);
        });
    }

    getArticles (options, cb) {

        if (typeof options === "function") {
            cb = options;
            options = {};
        }

        options = ul.merge(options, {
            skip: 0
          , per_page: 3
        });

        if (options.page) {
            let pageNumber = options.page - 1;
            options.skip = pageNumber * options.per_page;
        }

        this.getArticleIds((err, allIds) => {
            let count = allIds.length
              , pageInfo = {
                  hasNewer: false
                , hasOlder: false
                , count: count
                }
              ;

            let rangeIds = [];
            if (options.ids) {
                rangeIds = options.ids;
            } else {
                rangeIds = allIds.slice(-options.page * options.per_page, -options.skip || undefined)
                pageInfo.hasNewer = allIds.indexOf(rangeIds[rangeIds.length - 1]) < allIds.length - 1
                pageInfo.hasOlder = allIds.indexOf(rangeIds[0]) > 0
                rangeIds.reverse()
            }

            if (!rangeIds.length) {
                return cb(null, [], pageInfo);
            }

            sameTime(bindy(rangeIds, (cId, cb) => {
                this.getArticleById(cId, (err, data) => cb(null, err ? null : data));
            }), (err, articles) => {
                if (err) { return cb(err); }
                articles = articles.filter(Boolean);
                if (options.filter) {
                    articles = articles.filter(options.filter);
                }
                cb(null, articles, pageInfo);
            });
        });
    }

    getPageBySlug (slug, cb) {
        if (this.cache.pages[slug]) {
            return cb(null, this.cache.pages[slug]);
        }
        mdify.parseFile(this.getPagePath(slug), this.parseOpts, (err, data) => {
            if (err) { return cb(err); }
            data.slug = slug;
            data.metadata = data.metadata || 1;
            data.path = data.metadata.path || ("/" + data.slug);
            if (data.slug === this.options.routes.home) {
                data.path = "/"
            }
            if (data.metadata.html === true) {
                data.html = data.markdown;
            }

            data.summary_html = data.html.split("\n").slice(0, this.options.display.html_summary_paragraphs).join("\n")
            data.summary_html = data.html.split("\n").slice(0, this.options.display.html_summary_paragraphs).join("\n")
            data.image = data.metadata.image || (data.markdown.match(/!\[.*\]\((.*)\)/m) || [])[1] || ""
            data.summary = data.metadata.summary || (data.html.split("\n")[0] || "").replace(/(<([^>]+)>)/ig, "")
            if (data.slug === this.options.homePath) {
                data.path = "/";
            }
            cb(null, data);
        });
    }

    getPageSlugs (query, cb) {
        if (this.cache.pageSlugs) { return cb(null, this.cache.pageSlugs); }
        fs.readdir(`${this.paths.pages}`, (err, data) => {
            if (err) { return cb(err); }
            cb(null, data.filter(c => c.endsWith(".md")).map(c => c.replace(/\.md$/g, "")));
        });
    }

    getAllPageSlugs (cb) {
        this.getPageSlugs({}, cb);
    }

    getPages (query, cb) {
        if (!cb) {
            return this.getAllPages(query);
        }
        this.getPageSlugs(query, (err, slugs) => {
            if (err) { return cb(err); }
            sameTime(bindy(slugs, (slug, cb) => {
                this.getPageBySlug(slug, (err, data) => {
                    cb(null, err ? null : data)
                });
            }), (err, pages) => {
                if (err) { return cb(err); }
                pages = pages.filter(Boolean);
                pages.sort((a, b) => a.metadata.order < b.metadata.order ? -1 : 1);
                cb(null, pages);
            });
        });
    }

    getAllPages (cb) {
        return this.getPages({}, cb);
    }

    contentToHtml (content) {
        return mdify.parse(content, this.parseOpts).html;
    }

    getNextArticleId (cb) {
        this.getArticleIds((err, allIds) => {
            if (err) { return cb(err); }
            cb(null, Math.max.apply(null, allIds) + 1);
        });
    }

    createArticle (title, content, custom, cb) {
        this.getNextArticleId((err, nextId) => {
            this.saveArticle(nextId, title, content, custom, cb);
        });
    }

    saveArticle (id, title, content, custom, cb) {
        let metadata = custom || {};
        metadata.title = title;
        metadata.date = metadata.date || new Date();
        mdify.writeFile(this.getArticlePath(id), metadata, content, cb);
    }

    deleteArticle (id, cb) {
        fs.unlink(this.getArticlePath(id), cb);
    }
};
