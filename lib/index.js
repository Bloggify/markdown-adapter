"use strict";

const BloggifyAdapter = require("bloggify-adapter")
    , mdify = require("mdify")
    , ul = require("ul")
    , sameTime = require("same-time")
    , bindy = require("bindy")
    , fs = require("fs")
    , slugify = require("slug")
    ;

module.exports = class BloggifyMarkdownAdapter extends BloggifyAdapter {

    constructor (bloggify) {
        super(bloggify);
        this.parseOpts.converterOptions = ul.merge(this.parseOpts.converterOptions, {
            extensions: []
        });
    }

    getArticlePath (id) {
        return `${this.paths.articles}/${id}.md`;
    }

    getPagePath (slug) {
        return `${this.paths.pages}/${slug}.md`;
    }

    getArticleById (id, cb) {
        mdify.parseFile(this.getArticlePath(id), this.parseOpts, (err, data) => {
            if (err) { return cb(err); }
            data.id = id;
            data.slug = data.metadata.slug || slugify(data.metadata.title, { lower: true });
            data.path = `${this.bloggify.router.blogPath}/${data.id}-${data.slug}`;
            cb(null, data);
        });
    }

    getArticles (options, cb) {

        if (typeof options === "function") {
            cb = options;
            options = {};
        }


        options = ul.merge(options, {
            limit: 5
          , skip: 0
        });

        fs.readdir(this.paths.articles, (err, articles) => {
            if (err) { return cb(err); }

            let allIds = articles.map(c => parseInt(c)).filter(Boolean);
            let count = allIds.length;

            let rangeIds = [];
            if (options.ids) {
                rangeIds = options.ids;
            } else {
                for (let i = options.skip; i < options.skip + options.limit; ++i) {
                    rangeIds.push(count - i);
                }
            }

            if (!rangeIds.length) {
                return cb(null, []);
            }

            sameTime(bindy(rangeIds, (cId, cb) => {
                this.getArticleById(cId, (err, data) => cb(null, err ? null : data));
            }), (err, articles) => {
                if (err) { return cb(err); }
                articles = articles.filter(Boolean);
                cb(null, articles);
            });
        });

    }

    getPageBySlug (slug, cb) {
        mdify.parseFile(this.getPagePath(slug), this.parseOpts, (err, data) => {
            if (err) { return cb(err); }
            data.slug = slug;
            data.metadata = data.metadata || 1;
            data.path = data.metadata.path || ("/" + data.slug);
            if (data.metadata.html === true) {
                data.html = data.markdown;
            }
            if (data.slug === this.bloggify.router.homePath) {
                data.path = "/";
            }
            cb(null, data);
        });
    }

    getPageSlugs (query, cb) {
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
                pages.forEach(c => {
                });
                pages.sort((a, b) => a.metadata.order < b.metadata.order ? -1 : 1);
                cb(null, pages);
            });
        });
    }

    getAllPages (cb) {
        return this.getPages({}, cb);
    }
};
