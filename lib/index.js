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
            data.path = `${this.bloggify.router.articlePath}/${data.id}-${data.slug}`;
            data.content = data.markdown;
            cb(null, data);
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

        fs.readdir(this.paths.articles, (err, articles) => {
            if (err) { return cb(err); }

            let allIds = articles.map(c => parseInt(c)).filter(Boolean)
              , count = allIds.length
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
                let firstId = options.skip
                  , lastId = options.skip + options.per_page
                  ;

                for (let i = firstId; i < lastId; ++i) {
                    rangeIds.push(count - i);
                }

                pageInfo.hasNewer = firstId !== 0;
                pageInfo.hasOlder = lastId < count;
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

    contentToHtml (content) {
        return mdify.parse(content, this.parseOpts).html;
    }
};
