# frozen_string_literal: true

module ApayaStudioPro
  class BatchRenderManager
    MAX_CONCURRENT = 2

    attr_reader :queue, :active_count

    def initialize
      @queue        = []
      @active_count = 0
      @on_status_change = nil
      @on_complete      = nil
    end

    def on_status_change(&block); @on_status_change = block; end
    def on_complete(&block);      @on_complete      = block; end

    def add_jobs(jobs)
      jobs.each { |j| @queue << j.merge(status: 'queued') }
    end

    def next_jobs
      slots = MAX_CONCURRENT - @active_count
      @queue.select { |j| j[:status] == 'queued' }.first(slots)
    end

    def mark_processing(cam_name)
      job = find_job(cam_name)
      return unless job
      job[:status] = 'processing'
      @active_count += 1
      @on_status_change&.call(cam_name, 'processing')
    end

    def mark_done(cam_name, result_url, before_url = nil)
      job = find_job(cam_name)
      if job
        job[:status]     = 'done'
        job[:result_url] = result_url
        job[:before_url] = before_url
      end
      @active_count -= 1
      @on_status_change&.call(cam_name, 'done', result_url, before_url)
      check_completion
    end

    def mark_failed(cam_name)
      job = find_job(cam_name)
      job[:status] = 'failed' if job
      @active_count -= 1
      @on_status_change&.call(cam_name, 'failed')
      check_completion
    end

    def cancel_queued(cam_name)
      job = @queue.find { |j| j[:cam_name] == cam_name && j[:status] == 'queued' }
      return unless job
      job[:status] = 'cancelled'
      @on_status_change&.call(cam_name, 'cancelled')
    end

    def all_done?
      @queue.none? { |j| %w[queued processing].include?(j[:status]) }
    end

    def stats
      {
        total:      @queue.length,
        done:       @queue.count { |j| j[:status] == 'done' },
        failed:     @queue.count { |j| j[:status] == 'failed' },
        cancelled:  @queue.count { |j| j[:status] == 'cancelled' },
        processing: @queue.count { |j| j[:status] == 'processing' }
      }
    end

    private

    def find_job(cam_name)
      @queue.find { |j| j[:cam_name] == cam_name }
    end

    def check_completion
      @on_complete&.call(stats) if all_done?
    end
  end
end
